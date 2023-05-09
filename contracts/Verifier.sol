//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0

//////////////
// TODO: NEED TO GENERATE A NEW VERIFIER.
/////////////

pragma solidity ^0.8.12;
library Pairing {
    struct G1Point {
        uint X;
        uint Y;
    }
    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint[2] X;
        uint[2] Y;
    }
    /// @return the generator of G1
    function P1() internal pure returns (G1Point memory) {
        return G1Point(1, 2);
    }
    /// @return the generator of G2
    function P2() internal pure returns (G2Point memory) {
        // Original code point
        return G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );

/*
        // Changed by Jordi point
        return G2Point(
            [10857046999023057135944570762232829481370756359578518086990519993285655852781,
             11559732032986387107991004021392285783925812861821192530917403151452391805634],
            [8495653923123431417604973247489272438418190587263600148770280649306958101930,
             4082367875863433681332203403145435568316851327593401208105741076214120093531]
        );
*/
    }
    /// @return r the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negate(G1Point memory p) internal pure returns (G1Point memory r) {
        // The prime q in the base field F_q for G1
        uint q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        if (p.X == 0 && p.Y == 0)
            return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }
    /// @return r the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory r) {
        uint[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success,"pairing-add-failed");
    }
    /// @return r the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalar_mul(G1Point memory p, uint s) internal view returns (G1Point memory r) {
        uint[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success,"pairing-mul-failed");
    }
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
        require(p1.length == p2.length,"pairing-lengths-failed");
        uint elements = p1.length;
        uint inputSize = elements * 6;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
            input[i * 6 + 2] = p2[i].X[0];
            input[i * 6 + 3] = p2[i].X[1];
            input[i * 6 + 4] = p2[i].Y[0];
            input[i * 6 + 5] = p2[i].Y[1];
        }
        uint[1] memory out;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 8, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success,"pairing-opcode-failed");
        return out[0] != 0;
    }
    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(G1Point memory a1, G2Point memory a2, G1Point memory b1, G2Point memory b2) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](3);
        G2Point[] memory p2 = new G2Point[](3);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2,
            G1Point memory d1, G2Point memory d2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](4);
        G2Point[] memory p2 = new G2Point[](4);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p1[3] = d1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        p2[3] = d2;
        return pairing(p1, p2);
    }
}
contract Verifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }
    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.IC = new Pairing.G1Point[](23);
        
        vk.IC[0] = Pairing.G1Point( 
            6345625035907007648647156631169141088668972260668696632485644746448631142189,
            1787315389787281838713000160863555858825923346728574045670827674545223356873
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            6481079754661805137094215791254594040526184600722376422737734066452700325008,
            14478900998572844270619881316564617332379122408117952561896108901687289677566
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            13078721267399733136104397467931858852312237676548921972484381996942250265624,
            1748362704799022523045626152552407438343668507036909329650266569364111474548
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            16026021957911126231871741969427339165838878554367146057141338861638364356751,
            14899842232710115590584291789659822373625055087000286386690104969729505203421
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            3459274320194134980691712564314463162998204890691720802181168727959265335347,
            1856100767067364945173324162067892118351874712509717865013639661918917421436
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            1730444199711333500395095785167457505870281644144361482951649936018115451752,
            16226268759548605823710600834485279199665235997004958382986126351109032752483
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            19693053407616006957481533930062002091207976596954481348371563657186692999107,
            2422115246455710536663030586327174053850787031521558802255774727333170764990
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            1730766938889407647923999986620339979499937171002354848783020719561602547245,
            20989413897612581233663112095041318913772751778938307255977490127650098239397
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            16096236096969834003363255557530577452105879870517371051299177659344588245642,
            11016926842125500078143335165384340593271927876114865061774170616605750243943
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            912588438640122827702224830823957577427687103017226829806255537482538236749,
            14506165070853943179142981873721171315873100015557892017445119945526800972321
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            19155326942805100303993822197947492949549549284140388423401998288471551241004,
            2989856601230819588216329628277357426936058248756038872661629984824418086319
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            21280170726486817487312224345511317145948992080653671886934907575710969743816,
            15894920146550642135776769199672872793201486012392802614785969357619073685875
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            18247661317814424051975777883262158280537289325594639844496358549019663333917,
            17014806579915553870231245786729397480386549400768158302613592457656887708700
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            20568796218682820824651100596398886705201298927906778865008954050174894404079,
            12042528113145583017392662339832748861254432418227407729026212398503647124752
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            4028153745169543163879509240579809741046959237513344424412121809703092913923,
            4956636485317965387215132679787035575794606059879788203613024863777084420899
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            8388266276329007471926750296996871151174172972228897996484654434783673927513,
            11169663729961788661922834650406315553152733025572631400631085297338490960974
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            19816133709997441768288395143485336933280600313049868120897520205972980675830,
            7333930147927869277976604339105623489898859013027854438129711446699927520200
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            2344724007319275687509189588379536155087652120202331489455364019710103875209,
            21165256966404429511503777843413167611105181434391117805991246364676409818938
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            16368511732038242935059387762639104327852612375336651550576425114765462535588,
            2534416221208314662118272094432020426361494011657258553424619070823358408751
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            13764453553277278689227469029995344301656204701265967126182493651522396330567,
            12241658532931211106624637717325385821414629302218402555952478265435877298493
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            2748877456320013647824052577299298304187048968519478155789387350162714782453,
            576147530236029344786636454909833636851066704921361893573883237732088900322
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            2281517192421323523825805947356085443004900248370246265521865024259142339195,
            3608767008194600532587119271894966784361157514137997128405667071034023454069
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            19148594851313147837429178582622251468850707709003332003350289345127800690706,
            495678507691324991329551155843585784572260275366007291543234995152160315655
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[26] memory input
        ) public view returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}