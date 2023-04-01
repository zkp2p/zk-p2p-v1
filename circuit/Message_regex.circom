
pragma circom 2.0.3;

include "../zk-email-verify-circuits/regex_helpers.circom";

// Extract the custom Venmo message from the email
// Run this script https://github.com/zkemail/zk-email-verify/blob/main/regex_to_circom/lexical.js
// let regex = `<p>(0|1|2|3|4|5|6|7|8|9)+`
template MessageRegex (msg_bytes) {
    signal input msg[msg_bytes];
    signal output out;

    var num_bytes = msg_bytes;
    signal in[num_bytes];
    for (var i = 0; i < msg_bytes; i++) {
        in[i] <== msg[i];
    }
	
	component eq[3][num_bytes];
	component lt[4][num_bytes];
	component and[7][num_bytes];
	component multi_or[1][num_bytes];
	signal states[num_bytes+1][5];

	for (var i = 0; i < num_bytes; i++) {
		states[i][0] <== 1;
	}
	for (var i = 1; i < 5; i++) {
		states[0][i] <== 0;
	}

	for (var i = 0; i < num_bytes; i++) {
		eq[0][i] = IsEqual();
		eq[0][i].in[0] <== in[i];
		eq[0][i].in[1] <== 60;
		and[0][i] = AND();
		and[0][i].a <== states[i][0];
		and[0][i].b <== eq[0][i].out;
		states[i+1][1] <== and[0][i].out;
		eq[1][i] = IsEqual();
		eq[1][i].in[0] <== in[i];
		eq[1][i].in[1] <== 112;
		and[1][i] = AND();
		and[1][i].a <== states[i][1];
		and[1][i].b <== eq[1][i].out;
		states[i+1][2] <== and[1][i].out;
		eq[2][i] = IsEqual();
		eq[2][i].in[0] <== in[i];
		eq[2][i].in[1] <== 62;
		and[2][i] = AND();
		and[2][i].a <== states[i][2];
		and[2][i].b <== eq[2][i].out;
		states[i+1][3] <== and[2][i].out;
		lt[0][i] = LessThan(8);
		lt[0][i].in[0] <== 47;
		lt[0][i].in[1] <== in[i];
		lt[1][i] = LessThan(8);
		lt[1][i].in[0] <== in[i];
		lt[1][i].in[1] <== 58;
		and[3][i] = AND();
		and[3][i].a <== lt[0][i].out;
		and[3][i].b <== lt[1][i].out;
		and[4][i] = AND();
		and[4][i].a <== states[i][3];
		and[4][i].b <== and[3][i].out;
		lt[2][i] = LessThan(8);
		lt[2][i].in[0] <== 47;
		lt[2][i].in[1] <== in[i];
		lt[3][i] = LessThan(8);
		lt[3][i].in[0] <== in[i];
		lt[3][i].in[1] <== 58;
		and[5][i] = AND();
		and[5][i].a <== lt[2][i].out;
		and[5][i].b <== lt[3][i].out;
		and[6][i] = AND();
		and[6][i].a <== states[i][4];
		and[6][i].b <== and[5][i].out;
		multi_or[0][i] = MultiOR(2);
		multi_or[0][i].in[0] <== and[4][i].out;
		multi_or[0][i].in[1] <== and[6][i].out;
		states[i+1][4] <== multi_or[0][i].out;
	}

	signal final_state_sum[num_bytes+1];
	final_state_sum[0] <== states[0][4];
	for (var i = 1; i <= num_bytes; i++) {
		final_state_sum[i] <== final_state_sum[i-1] + states[i][4];
	}
	out <== final_state_sum[num_bytes];

    // Vector that masks the email with mostly 0s, but reveals the regex string
    signal output reveal[num_bytes];
    for (var i = 0; i < num_bytes; i++) {
        reveal[i] <== in[i] * states[i+1][1];
    }
}
