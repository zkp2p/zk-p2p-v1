
pragma circom 2.1.0;

template Factors() {
    signal input x;
    signal input y;
    signal output z;

    z <== x * y;
}

component main = Factors();