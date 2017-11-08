import json


def sql_result_to_json(result, defs):
    l = []
    defs_for_json = [str(definition) for definition in defs]
    for row in result:
        d = {}
        for i in range(len(defs_for_json)):
            d[defs_for_json[i]] = row[i]

        l.append(d)

    print(l);

    return json.dumps(l)
