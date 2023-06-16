import subprocess
import json
import string
import sys

# Clear file
OUTPUT_HALO2 = False

# Accept argument for file name
if len(sys.argv) != 2:
    print("Usage: python3 gen.py <regex_name>")
    exit(1)

regex_name = sys.argv[1]


graph_json = json.loads(subprocess.check_output(['npx', 'tsx', 'lexical.js']))
N = len(graph_json)

# Outgoing nodes
graph = [{} for i in range(N)]
# Incoming Nodes
rev_graph = [[] for i in range(N)]
accept_nodes = set()

for i in range(N):
    for k in graph_json[i]['edges']:
        # assert len(k) == 1
        # assert ord(k) < 128
        v = graph_json[i]['edges'][k]
        graph[i][k] = v
        rev_graph[v].append((k, i))
        # Iterates over value in set for halo2 lookup, append to file

    if graph_json[i]['type'] == 'accept':
        accept_nodes.add(i)

accept_nodes = list(accept_nodes)
assert len(accept_nodes) == 1

if (OUTPUT_HALO2):
    with open('halo2_regex_lookup.txt', 'w') as f:
        for a in accept_nodes:
            print(str(a) + " ", file=f, end='')
        print("", file=f)
    for i in range(N):
        for k in graph_json[i]['edges']:
            v = graph_json[i]['edges'][k]
            for val in json.loads(k):
                with open('halo2_regex_lookup.txt', 'a') as f:
                    print(i, v, ord(val), file=f)

# print("Accept node:", accept_nodes)
# print("Rev graph:", rev_graph)
# print("Graph:", graph)
# print("Graph json:", graph_json)

eq_i = 0
lt_i = 0
and_i = 0
multi_or_i = 0

lines = []
lines.append("for (var i = 0; i < num_bytes; i++) {")

assert 0 not in accept_nodes

for i in range(1, N):
    outputs = []
    for k, prev_i in rev_graph[i]:
        vals = json.loads(k)
        eq_outputs = []

        uppercase = set(string.ascii_uppercase)
        lowercase = set(string.ascii_lowercase)
        digits = set(string.digits)
        vals = set(vals)

        if uppercase <= vals:
            vals -= uppercase
            # 64 < x < 91
            lines.append(f"\tlt[{lt_i}][i] = LessThan(8);")
            lines.append(f"\tlt[{lt_i}][i].in[0] <== in[i] - 65 - 10944121435919637611123202872628637544274182200208017171849102093287904247808;")
            lines.append(f"\tlt[{lt_i}][i].in[1] <== 27;")

            eq_outputs.append(('lt', lt_i))
            lt_i += 1

        if lowercase <= vals:
            vals -= lowercase
            # 96 < x < 123
            lines.append(f"\tlt[{lt_i}][i] = LessThan(8);")
            lines.append(f"\tlt[{lt_i}][i].in[0] <== in[i] - 97 - 10944121435919637611123202872628637544274182200208017171849102093287904247808;")
            lines.append(f"\tlt[{lt_i}][i].in[1] <== 27;")

            eq_outputs.append(('lt', lt_i))
            lt_i += 1

        if digits <= vals:
            vals -= digits
            # 47 < x < 58
            lines.append(f"\tlt[{lt_i}][i] = LessThan(8);")
            lines.append(f"\tlt[{lt_i}][i].in[0] <== in[i] - 48 - 10944121435919637611123202872628637544274182200208017171849102093287904247808;")
            lines.append(f"\tlt[{lt_i}][i].in[1] <== 11;")

            eq_outputs.append(('lt', lt_i))
            lt_i += 1

        for c in vals:
            assert len(c) == 1
            lines.append(f"\teq[{eq_i}][i] = IsEqual();")
            lines.append(f"\teq[{eq_i}][i].in[0] <== in[i];")
            lines.append(f"\teq[{eq_i}][i].in[1] <== {ord(c)};")
            eq_outputs.append(('eq', eq_i))
            eq_i += 1

        lines.append(f"\tand[{and_i}][i] = AND();")
        lines.append(f"\tand[{and_i}][i].a <== states[i][{prev_i}];")

        if len(eq_outputs) == 1:
            lines.append(f"\tand[{and_i}][i].b <== {eq_outputs[0][0]}[{eq_outputs[0][1]}][i].out;")
        elif len(eq_outputs) > 1:
            lines.append(f"\tmulti_or[{multi_or_i}][i] = MultiOR({len(eq_outputs)});")
            for output_i in range(len(eq_outputs)):
                lines.append(f"\tmulti_or[{multi_or_i}][i].in[{output_i}] <== {eq_outputs[output_i][0]}[{eq_outputs[output_i][1]}][i].out;")
            lines.append(f"\tand[{and_i}][i].b <== multi_or[{multi_or_i}][i].out;")
            multi_or_i += 1

        outputs.append(and_i)
        and_i += 1
        # print(f"states[i+1][{i}] = states[i][{prev_i}] AND (in[i] == {repr(k)})")
    if len(outputs) == 1:
        lines.append(f"\tstates[i+1][{i}] <== and[{outputs[0]}][i].out;")
    elif len(outputs) > 1:
        lines.append(f"\tmulti_or[{multi_or_i}][i] = MultiOR({len(outputs)});")
        for output_i in range(len(outputs)):
            lines.append(f"\tmulti_or[{multi_or_i}][i].in[{output_i}] <== and[{outputs[output_i]}][i].out;")
        lines.append(f"\tstates[i+1][{i}] <== multi_or[{multi_or_i}][i].out;")
        multi_or_i += 1

lines.append("}")

declarations = []

if eq_i > 0:
    declarations.append(f"component eq[{eq_i}][num_bytes];")
if lt_i > 0:
    declarations.append(f"component lt[{lt_i}][num_bytes];")
if and_i > 0:
    declarations.append(f"component and[{and_i}][num_bytes];")
if multi_or_i > 0:
    declarations.append(f"component multi_or[{multi_or_i}][num_bytes];")
declarations.append(f"signal states[num_bytes+1][{N}];")
declarations.append("")

init_code = []

init_code.append("for (var i = 0; i < num_bytes; i++) {")
init_code.append("\tstates[i][0] <== 1;")
init_code.append("}")

init_code.append(f"for (var i = 1; i < {N}; i++) {{")
init_code.append("\tstates[0][i] <== 0;")
init_code.append("}")

init_code.append("")

lines = declarations + init_code + lines

accept_node = accept_nodes[0]
accept_lines = [""]
accept_lines.append("signal final_state_sum[num_bytes+1];")
accept_lines.append(f"final_state_sum[0] <== states[0][{accept_node}];")
accept_lines.append("for (var i = 1; i <= num_bytes; i++) {")
accept_lines.append(f"\tfinal_state_sum[i] <== final_state_sum[i-1] + states[i][{accept_node}];")
accept_lines.append("}")
accept_lines.append("out <== final_state_sum[num_bytes];")

lines += accept_lines

# print("\n".join(lines))

# Write the file



with open(f"../circuit/{regex_name}_regex.circom", "w") as f:
    f.write(
        f"""
pragma circom 2.0.3;

include "../zk-email-verify-circuits/regex_helpers.circom";

template {regex_name}Regex (msg_bytes) {{
    signal input msg[msg_bytes];
    signal output out;

    var num_bytes = msg_bytes;
    signal in[num_bytes];
    for (var i = 0; i < msg_bytes; i++) {{
        in[i] <== msg[i];
    }}
\t
"""
)
    
    f.write("\n\t".join(lines))
    f.write("\n")
    f.write(
    """
    // Vector that masks the email with mostly 0s, but reveals the regex string
    signal output reveal[num_bytes];
    for (var i = 0; i < num_bytes; i++) {
        reveal[i] <== in[i] * states[i+1][1];
    }
}
"""
    )
