import os, json, hashlib

DATA_DIR = "data/"

def load_snapshot(key):
    path = os.path.join(DATA_DIR, f"{key}.json")
    return json.load(open(path)) if os.path.exists(path) else []

def save_snapshot(key, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    json.dump(data, open(os.path.join(DATA_DIR, f"{key}.json"), "w"))

def compute_diff(old, new):
    old_set, new_set = set(old), set(new)
    return list(new_set - old_set)
