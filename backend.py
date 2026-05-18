from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import csv
import json
import math
import os
import statistics
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", 4173))


def parse_churn(value):
    normalized = str(value or "").strip().lower()
    if normalized in {"yes", "y", "true", "1", "churned", "left", "ported", "terminated"}:
        return 1
    if normalized in {"no", "n", "false", "0", "active", "stayed", "retained"}:
        return 0
    return None


def truthy(value):
    return str(value or "").strip().lower() in {"yes", "y", "true", "1", "enabled", "opted in"}


def sigmoid(value):
    return 1 / (1 + math.exp(-max(-35, min(35, value))))


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def build_encoder(rows):
    excluded = {"customer_id", "phone_number", "churned"}
    keys = [
        key
        for key in rows[0].keys()
        if key not in excluded and any(str(row.get(key, "")).strip() for row in rows)
    ]
    meta = []
    feature_names = []

    for key in keys:
        values = [row.get(key, "") for row in rows if str(row.get(key, "")).strip()]
        numeric_values = []
        for value in values:
            try:
                numeric_values.append(float(value))
            except ValueError:
                pass

        if len(numeric_values) >= max(5, len(values) * 0.65):
            mean = statistics.fmean(numeric_values)
            std = statistics.pstdev(numeric_values) or 1
            meta.append({"key": key, "type": "numeric", "mean": mean, "std": std})
            feature_names.append(key)
        else:
            counts = {}
            for value in values:
                clean = str(value).strip()
                counts[clean] = counts.get(clean, 0) + 1
            categories = sorted(counts, key=counts.get, reverse=True)[:6]
            meta.append({"key": key, "type": "category", "categories": categories})
            feature_names.extend(f"{key}={category}" for category in categories)

    return {"meta": meta, "feature_names": feature_names}


def encode_row(row, encoder):
    values = []
    for item in encoder["meta"]:
        if item["type"] == "numeric":
            try:
                value = float(row.get(item["key"], ""))
                values.append((value - item["mean"]) / item["std"])
            except ValueError:
                values.append(0)
        else:
            actual = str(row.get(item["key"], "")).strip()
            values.extend(1 if actual == category else 0 for category in item["categories"])
    return values


def train_logistic(dataset, size):
    weights = [0.0] * size
    bias = 0.0
    learning_rate = 0.08
    regularization = 0.002

    for _ in range(850):
        gradient = [0.0] * size
        bias_gradient = 0.0
        for item in dataset:
            prediction = sigmoid(dot(weights, item["x"]) + bias)
            error = prediction - item["y"]
            for index, value in enumerate(item["x"]):
                gradient[index] += error * value
            bias_gradient += error

        for index, weight in enumerate(weights):
            weights[index] = weight - learning_rate * (gradient[index] / len(dataset) + regularization * weight)
        bias -= learning_rate * (bias_gradient / len(dataset))

    return {"weights": weights, "bias": bias}


def evaluate(model, dataset):
    correct = 0
    true_positive = 0
    false_negative = 0

    for item in dataset:
        predicted = 1 if sigmoid(dot(model["weights"], item["x"]) + model["bias"]) >= 0.5 else 0
        if predicted == item["y"]:
            correct += 1
        if item["y"] == 1 and predicted == 1:
            true_positive += 1
        if item["y"] == 1 and predicted == 0:
            false_negative += 1

    return {
        "accuracy": correct / len(dataset),
        "recall": 0 if true_positive + false_negative == 0 else true_positive / (true_positive + false_negative),
    }


def humanize(name):
    return " ".join(word.capitalize() for word in name.replace("=", ": ").replace("_", " ").split())


def explain(row, encoder, model):
    encoded = encode_row(row, encoder)
    impacts = [
        {"name": humanize(name), "impact": model["weights"][index] * encoded[index]}
        for index, name in enumerate(encoder["feature_names"])
    ]
    return [item["name"] for item in sorted(impacts, key=lambda value: value["impact"], reverse=True) if item["impact"] > 0.04][:3]


def risk_level(probability):
    if probability >= 0.85:
        return "Critical"
    if probability >= 0.7:
        return "High"
    if probability >= 0.45:
        return "Medium"
    return "Low"


def suggest_offer(row, reasons, risk):
    reason_text = " ".join(reasons).lower()
    network_issues = float(row.get("network_issue_count_90d") or 0)
    monthly_charge = float(row.get("monthly_charge_inr") or 0)
    data_usage = float(row.get("avg_data_usage_gb") or 0)
    if "network" in reason_text or network_issues >= 5:
        return "Network care callback + service credit"
    if "monthly" in reason_text or monthly_charge >= 799:
        return "15-25% bill discount"
    if "data" in reason_text or data_usage >= 70:
        return "Extra 20GB data pack"
    if risk >= 0.85:
        return "Priority retention call"
    return "Recharge cashback offer"


def train_payload(rows):
    training_rows = [row for row in rows if row.get("customer_id") and parse_churn(row.get("churned")) is not None]
    if len(training_rows) < 10:
        raise ValueError("Need at least 10 labeled rows to train.")

    encoder = build_encoder(training_rows)
    if len(encoder["feature_names"]) < 2:
        raise ValueError("Need at least 2 usable features to train.")

    dataset = [{"x": encode_row(row, encoder), "y": parse_churn(row.get("churned")), "row": row} for row in training_rows]
    split_index = max(1, int(len(dataset) * 0.75))
    train_set = dataset[:split_index]
    test_set = dataset[split_index:] or train_set
    model = train_logistic(train_set, len(encoder["feature_names"]))
    metrics = evaluate(model, test_set)

    predictions = []
    for row in rows:
        if not row.get("customer_id"):
            continue
        risk = sigmoid(dot(model["weights"], encode_row(row, encoder)) + model["bias"])
        reasons = explain(row, encoder, model)
        predictions.append(
            {
                **row,
                "risk": risk,
                "level": risk_level(risk),
                "reasons": reasons,
                "suggestedOffer": suggest_offer(row, reasons, risk),
            }
        )

    drivers = [
        {"name": humanize(name), "weight": weight}
        for name, weight in sorted(zip(encoder["feature_names"], model["weights"]), key=lambda item: item[1], reverse=True)
        if weight > 0
    ][:8]

    return {
        "metrics": metrics,
        "predictions": sorted(predictions, key=lambda row: row["risk"], reverse=True),
        "drivers": drivers,
        "engine": "Python logistic regression",
    }


class RetainIQHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/train":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            result = train_payload(payload.get("rows", []))
            self.send_json(200, result)
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("", PORT), RetainIQHandler)
    print(f"Server running at http://localhost:{PORT}")
    server.serve_forever()
