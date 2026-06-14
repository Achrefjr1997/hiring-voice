import re


def _camel_to_snake(name: str) -> str:
    result = []
    for char in name:
        if char.isupper() and result:
            result.append("_")
        result.append(char.lower())
    return "".join(result).lstrip("_")


def normalize_keys(d: dict) -> dict:
    new = {}
    for k, v in d.items():
        sk = _camel_to_snake(k)
        if isinstance(v, dict):
            new[sk] = normalize_keys(v)
        elif isinstance(v, list):
            new[sk] = [normalize_keys(i) if isinstance(i, dict) else i for i in v]
        else:
            new[sk] = v
    return new
