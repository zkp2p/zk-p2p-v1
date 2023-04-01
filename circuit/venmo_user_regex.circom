pragma circom 2.0.3;

include "../zk-email-verify-circuits/regex_helpers.circom";

// Extract the onramp user ID from the email
// Run this script https://github.com/zkemail/zk-email-verify/blob/main/regex_to_circom/lexical.js
// let regex = `&actor_id=3D(0|1|2|3|4|5|6|7|8|9)+">`
template VenmoUserRegex (msg_bytes) {
    signal input msg[msg_bytes];
    signal output out;

    var num_bytes = msg_bytes;
    signal in[num_bytes];
    for (var i = 0; i < msg_bytes; i++) {
        in[i] <== msg[i];
    }

    component eq[14][num_bytes];
    component lt[4][num_bytes];
    component and[18][num_bytes];
    component multi_or[1][num_bytes];
    signal states[num_bytes+1][16];

    for (var i = 0; i < num_bytes; i++) {
        states[i][0] <== 1;
    }
    for (var i = 1; i < 16; i++) {
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
        and[1][i] = AND();
        and[1][i].a <== states[i][1];
        and[1][i].b <== and[0][i].out;
        lt[2][i] = LessThan(8);
        lt[2][i].in[0] <== 47;
        lt[2][i].in[1] <== in[i];
        lt[3][i] = LessThan(8);
        lt[3][i].in[0] <== in[i];
        lt[3][i].in[1] <== 58;
        and[2][i] = AND();
        and[2][i].a <== lt[2][i].out;
        and[2][i].b <== lt[3][i].out;
        and[3][i] = AND();
        and[3][i].a <== states[i][14];
        and[3][i].b <== and[2][i].out;
        multi_or[0][i] = MultiOR(2);
        multi_or[0][i].in[0] <== and[1][i].out;
        multi_or[0][i].in[1] <== and[3][i].out;
        states[i+1][1] <== multi_or[0][i].out;
        eq[0][i] = IsEqual();
        eq[0][i].in[0] <== in[i];
        eq[0][i].in[1] <== 62;
        and[4][i] = AND();
        and[4][i].a <== states[i][15];
        and[4][i].b <== eq[0][i].out;
        states[i+1][2] <== and[4][i].out;
        eq[1][i] = IsEqual();
        eq[1][i].in[0] <== in[i];
        eq[1][i].in[1] <== 38;
        and[5][i] = AND();
        and[5][i].a <== states[i][0];
        and[5][i].b <== eq[1][i].out;
        states[i+1][3] <== and[5][i].out;
        eq[2][i] = IsEqual();
        eq[2][i].in[0] <== in[i];
        eq[2][i].in[1] <== 97;
        and[6][i] = AND();
        and[6][i].a <== states[i][3];
        and[6][i].b <== eq[2][i].out;
        states[i+1][4] <== and[6][i].out;
        eq[3][i] = IsEqual();
        eq[3][i].in[0] <== in[i];
        eq[3][i].in[1] <== 99;
        and[7][i] = AND();
        and[7][i].a <== states[i][4];
        and[7][i].b <== eq[3][i].out;
        states[i+1][5] <== and[7][i].out;
        eq[4][i] = IsEqual();
        eq[4][i].in[0] <== in[i];
        eq[4][i].in[1] <== 116;
        and[8][i] = AND();
        and[8][i].a <== states[i][5];
        and[8][i].b <== eq[4][i].out;
        states[i+1][6] <== and[8][i].out;
        eq[5][i] = IsEqual();
        eq[5][i].in[0] <== in[i];
        eq[5][i].in[1] <== 111;
        and[9][i] = AND();
        and[9][i].a <== states[i][6];
        and[9][i].b <== eq[5][i].out;
        states[i+1][7] <== and[9][i].out;
        eq[6][i] = IsEqual();
        eq[6][i].in[0] <== in[i];
        eq[6][i].in[1] <== 114;
        and[10][i] = AND();
        and[10][i].a <== states[i][7];
        and[10][i].b <== eq[6][i].out;
        states[i+1][8] <== and[10][i].out;
        eq[7][i] = IsEqual();
        eq[7][i].in[0] <== in[i];
        eq[7][i].in[1] <== 95;
        and[11][i] = AND();
        and[11][i].a <== states[i][8];
        and[11][i].b <== eq[7][i].out;
        states[i+1][9] <== and[11][i].out;
        eq[8][i] = IsEqual();
        eq[8][i].in[0] <== in[i];
        eq[8][i].in[1] <== 105;
        and[12][i] = AND();
        and[12][i].a <== states[i][9];
        and[12][i].b <== eq[8][i].out;
        states[i+1][10] <== and[12][i].out;
        eq[9][i] = IsEqual();
        eq[9][i].in[0] <== in[i];
        eq[9][i].in[1] <== 100;
        and[13][i] = AND();
        and[13][i].a <== states[i][10];
        and[13][i].b <== eq[9][i].out;
        states[i+1][11] <== and[13][i].out;
        eq[10][i] = IsEqual();
        eq[10][i].in[0] <== in[i];
        eq[10][i].in[1] <== 61;
        and[14][i] = AND();
        and[14][i].a <== states[i][11];
        and[14][i].b <== eq[10][i].out;
        states[i+1][12] <== and[14][i].out;
        eq[11][i] = IsEqual();
        eq[11][i].in[0] <== in[i];
        eq[11][i].in[1] <== 51;
        and[15][i] = AND();
        and[15][i].a <== states[i][12];
        and[15][i].b <== eq[11][i].out;
        states[i+1][13] <== and[15][i].out;
        eq[12][i] = IsEqual();
        eq[12][i].in[0] <== in[i];
        eq[12][i].in[1] <== 68;
        and[16][i] = AND();
        and[16][i].a <== states[i][13];
        and[16][i].b <== eq[12][i].out;
        states[i+1][14] <== and[16][i].out;
        eq[13][i] = IsEqual();
        eq[13][i].in[0] <== in[i];
        eq[13][i].in[1] <== 34;
        and[17][i] = AND();
        and[17][i].a <== states[i][1];
        and[17][i].b <== eq[13][i].out;
        states[i+1][15] <== and[17][i].out;
    }

    signal final_state_sum[num_bytes+1];
    final_state_sum[0] <== states[0][2];
    for (var i = 1; i <= num_bytes; i++) {
        final_state_sum[i] <== final_state_sum[i-1] + states[i][2];
    }
    out <== final_state_sum[num_bytes];

    // Vector that masks the email with mostly 0s, but reveals the Venmo IDs
    signal output reveal[num_bytes];
    for (var i = 0; i < num_bytes; i++) {
        reveal[i] <== in[i] * states[i+1][1];
    }
}
