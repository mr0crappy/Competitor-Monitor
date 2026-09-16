def compute_diff(old, new):
    old_set = set(old)
    return [item for item in new if item not in old_set]