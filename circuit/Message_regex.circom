
pragma circom 2.0.3;

include "../zk-email-verify-circuits/regex_helpers.circom";

template MessageRegex (msg_bytes) {
    signal input msg[msg_bytes];
    signal output out;

    var num_bytes = msg_bytes;
    signal in[num_bytes];
    for (var i = 0; i < msg_bytes; i++) {
        in[i] <== msg[i];
    }
	
	component eq[15][num_bytes];
	component lt[4][num_bytes];
	component and[7][num_bytes];
	component multi_or[3][num_bytes];
	signal states[num_bytes+1][5];
	
	for (var i = 0; i < num_bytes; i++) {
		states[i][0] <== 1;
	}
	for (var i = 1; i < 5; i++) {
		states[0][i] <== 0;
	}
	
	for (var i = 0; i < num_bytes; i++) {
		lt[0][i] = LessThan(8);
		lt[0][i].in[0] <== 47;
		lt[0][i].in[1] <== in[i];
		lt[1][i] = LessThan(8);
		lt[1][i].in[0] <== in[i];
		lt[1][i].in[1] <== 58;
		and[0][i] = AND();
		and[0][i].a <== lt[0][i].out;
		and[0][i].b <== lt[1][i].out;
		eq[0][i] = IsEqual();
		eq[0][i].in[0] <== in[i];
		eq[0][i].in[1] <== 99;
		eq[1][i] = IsEqual();
		eq[1][i].in[0] <== in[i];
		eq[1][i].in[1] <== 101;
		eq[2][i] = IsEqual();
		eq[2][i].in[0] <== in[i];
		eq[2][i].in[1] <== 102;
		eq[3][i] = IsEqual();
		eq[3][i].in[0] <== in[i];
		eq[3][i].in[1] <== 97;
		eq[4][i] = IsEqual();
		eq[4][i].in[0] <== in[i];
		eq[4][i].in[1] <== 100;
		eq[5][i] = IsEqual();
		eq[5][i].in[0] <== in[i];
		eq[5][i].in[1] <== 98;
		and[1][i] = AND();
		and[1][i].a <== states[i][1];
		multi_or[0][i] = MultiOR(7);
		multi_or[0][i].in[0] <== and[0][i].out;
		multi_or[0][i].in[1] <== eq[0][i].out;
		multi_or[0][i].in[2] <== eq[1][i].out;
		multi_or[0][i].in[3] <== eq[2][i].out;
		multi_or[0][i].in[4] <== eq[3][i].out;
		multi_or[0][i].in[5] <== eq[4][i].out;
		multi_or[0][i].in[6] <== eq[5][i].out;
		and[1][i].b <== multi_or[0][i].out;
		lt[2][i] = LessThan(8);
		lt[2][i].in[0] <== 47;
		lt[2][i].in[1] <== in[i];
		lt[3][i] = LessThan(8);
		lt[3][i].in[0] <== in[i];
		lt[3][i].in[1] <== 58;
		and[2][i] = AND();
		and[2][i].a <== lt[2][i].out;
		and[2][i].b <== lt[3][i].out;
		eq[6][i] = IsEqual();
		eq[6][i].in[0] <== in[i];
		eq[6][i].in[1] <== 99;
		eq[7][i] = IsEqual();
		eq[7][i].in[0] <== in[i];
		eq[7][i].in[1] <== 101;
		eq[8][i] = IsEqual();
		eq[8][i].in[0] <== in[i];
		eq[8][i].in[1] <== 102;
		eq[9][i] = IsEqual();
		eq[9][i].in[0] <== in[i];
		eq[9][i].in[1] <== 97;
		eq[10][i] = IsEqual();
		eq[10][i].in[0] <== in[i];
		eq[10][i].in[1] <== 100;
		eq[11][i] = IsEqual();
		eq[11][i].in[0] <== in[i];
		eq[11][i].in[1] <== 98;
		and[3][i] = AND();
		and[3][i].a <== states[i][4];
		multi_or[1][i] = MultiOR(7);
		multi_or[1][i].in[0] <== and[2][i].out;
		multi_or[1][i].in[1] <== eq[6][i].out;
		multi_or[1][i].in[2] <== eq[7][i].out;
		multi_or[1][i].in[3] <== eq[8][i].out;
		multi_or[1][i].in[4] <== eq[9][i].out;
		multi_or[1][i].in[5] <== eq[10][i].out;
		multi_or[1][i].in[6] <== eq[11][i].out;
		and[3][i].b <== multi_or[1][i].out;
		multi_or[2][i] = MultiOR(2);
		multi_or[2][i].in[0] <== and[1][i].out;
		multi_or[2][i].in[1] <== and[3][i].out;
		states[i+1][1] <== multi_or[2][i].out;
		eq[12][i] = IsEqual();
		eq[12][i].in[0] <== in[i];
		eq[12][i].in[1] <== 60;
		and[4][i] = AND();
		and[4][i].a <== states[i][0];
		and[4][i].b <== eq[12][i].out;
		states[i+1][2] <== and[4][i].out;
		eq[13][i] = IsEqual();
		eq[13][i].in[0] <== in[i];
		eq[13][i].in[1] <== 112;
		and[5][i] = AND();
		and[5][i].a <== states[i][2];
		and[5][i].b <== eq[13][i].out;
		states[i+1][3] <== and[5][i].out;
		eq[14][i] = IsEqual();
		eq[14][i].in[0] <== in[i];
		eq[14][i].in[1] <== 62;
		and[6][i] = AND();
		and[6][i].a <== states[i][3];
		and[6][i].b <== eq[14][i].out;
		states[i+1][4] <== and[6][i].out;
	}
	
	signal final_state_sum[num_bytes+1];
	final_state_sum[0] <== states[0][1];
	for (var i = 1; i <= num_bytes; i++) {
		final_state_sum[i] <== final_state_sum[i-1] + states[i][1];
	}
	out <== final_state_sum[num_bytes];

    // Vector that masks the email with mostly 0s, but reveals the regex string
    signal output reveal[num_bytes];
    for (var i = 0; i < num_bytes; i++) {
        reveal[i] <== in[i] * states[i+1][1];
    }
}
