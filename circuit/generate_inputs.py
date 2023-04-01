import json

input_dict = {
    "x": "2",
    "y": "3",
}

with open("input.json", "w") as f:
    f.write(json.dumps(input_dict))