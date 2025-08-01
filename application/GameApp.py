from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import logging

app = Flask(__name__)
CORS(app) 
DATA_DIR = "data"

# Vérifie si le répertoire existe
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

@app.route("/save", methods=["POST"])
def save_json():
    data = request.json
    filename = request.args.get("filename", "default.json")
    filepath = os.path.join(DATA_DIR, filename)
    logging.warning(filepath)

    with open(filepath, "w") as json_file:
        json.dump(data, json_file)
    return jsonify({"message": f"Fichier {filename} enregistré."}), 200

@app.route("/load", methods=["GET"])
def load_json():
    filename = request.args.get("filename", "default.json")
    filepath = os.path.join(DATA_DIR, filename)

    logging.warning(filepath)
    if not os.path.exists(filepath):
        return jsonify({"error": "Fichier introuvable"}), 404

    with open(filepath, "r") as json_file:
        data = json.load(json_file)
    return jsonify(data), 200

if __name__ == "__main__":
    app.run(debug=True)
