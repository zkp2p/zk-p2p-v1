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
        {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
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
            [18752765634221131536040718841182653572385266263578259846555920575829188408842,
             18343787293769392392043538357145346990041456807511860852668885818287263604287],
            [6711887219366600236350231878683324849528668226872854947928281266517439293176,
             7944160890904605020145707154269084865339311007131905940349194168493450075001]
        );
        vk.IC = new Pairing.G1Point[](27);

        vk.IC[0] = Pairing.G1Point(
            11390303289064284098189744438463447420778707582462791052618307568031589832040,
            7449448169535529458378919271505148978539356638415795572750354322373068439362
        );

        vk.IC[1] = Pairing.G1Point(
            12926512673301137570628263349765214889130631160950332406024037635286650507630,
            8992052977473807772447083576919945335702173772905787498293268627890617242997
        );

        vk.IC[2] = Pairing.G1Point(
            10300435939865091196742379379501283306448703934998001867487926349042531050125,
            14928439355818328326375363823537703358818022931799429941075037725307577070455
        );

        vk.IC[3] = Pairing.G1Point(
            7611413456733281848700061561983325504251513662385561049933512147189344189699,
            4833185216270508713342192501912663935130269443612842251206521878230971676839
        );

        vk.IC[4] = Pairing.G1Point(
            19062247490960708321777748170389762379672856148924642110378887144213419852566,
            6239888245029187530537044168742210282838199991619156575647864448012631067705
        );

        vk.IC[5] = Pairing.G1Point(
            1900533091959672810586142219238009988575950672610752410245631793102644183020,
            8209782988030410782646465527164053824222196574783486141746214338752832758379
        );

        vk.IC[6] = Pairing.G1Point(
            8878510019023174601370916887464135804425456732601707876870283071941319158779,
            2238933498147138257708057025060058512632744467048518254794891840583200928651
        );

        vk.IC[7] = Pairing.G1Point(
            14774264761588045430490817263961834820949201219760292402883462377258134489261,
            13565063219270278023061572736709176503347437541058744868567068106406233758095
        );

        vk.IC[8] = Pairing.G1Point(
            8640222970343729307611189667179627998087825168565600334875558967992577664369,
            14110274253571946477699011561265474162427343516115444871710303863258194976702
        );

        vk.IC[9] = Pairing.G1Point(
            2595280839257795204498281112565360451329597440214622571669060445042599277667,
            12806000801103941363924896892277761387543153396726070951416512053768776176473
        );

        vk.IC[10] = Pairing.G1Point(
            16097556813974149893401667692330725086078736852759927722019755388159570888179,
            21041500172099620828948779396096271241391891618911735365565777088038720129820
        );

        vk.IC[11] = Pairing.G1Point(
            8502891934148992894234766665284434965333422143486619420599160188496289298766,
            10432356863447150028693163504190402489144219087927812414716985309187094963373
        );

        vk.IC[12] = Pairing.G1Point(
            7657191410121949604532752880122711166479708868216582440269748853989575610007,
            20010265458375447628489286987142310761594415204146061186951685402842014748556
        );

        vk.IC[13] = Pairing.G1Point(
            4109233900831522958415334035503369207374528764471261924191406262792133590161,
            3446961700970273147427294976869718002542009503298635780540177324259631759666
        );

        vk.IC[14] = Pairing.G1Point(
            2999051556079069777151853990146500844490545822224819880971649206202307535626,
            20767119344253261102966821628433281607825360200248254451575874541861067020033
        );

        vk.IC[15] = Pairing.G1Point(
            12935231153420133683806436064217241608814572033955662233616391592624581848743,
            758401520845175001964281383234391730940870430820194255681311894447544715649
        );

        vk.IC[16] = Pairing.G1Point(
            16944115134472787995924248861831098501730291888520747962165860185180158785640,
            20166735440122921194353354674357418838459453043867299035185577606103206863362
        );

        vk.IC[17] = Pairing.G1Point(
            16370904269034995920740050962123727789402746519779569403976467135105461698075,
            14449271159026100159899871807797201759680724040929735003794398191584825703054
        );

        vk.IC[18] = Pairing.G1Point(
            4575501916420720895898002167414775436285619437696512628470738161818319565343,
            10259221667769872405798976776109799802312224894204101284658645978943530534476
        );

        vk.IC[19] = Pairing.G1Point(
            9466546245760905072516718698902616405319448266431304502642473889515878674758,
            386151568081870823815772299620009618170598555506537057870884344002746885784
        );

        vk.IC[20] = Pairing.G1Point(
            18647704995794871178778602066785346048858539589664585854089930952033006245268,
            10882072269148921751625569635653085812004835078077584218985179564268085978911
        );

        vk.IC[21] = Pairing.G1Point(
            12906617616864950231846033602870348293620432768295722554148786123483296821895,
            1158115217019412570000102563141115303282553866405915609770644931957018820227
        );

        vk.IC[22] = Pairing.G1Point(
            13492979305308929563551152505636677944284946254909375630290488183092914383791,
            5668308865271279078741142041312696139694684618169069800309774365915338294251
        );

            18685571392392720007478153403859740179162471232692219332488240021841431745434
        );

            20983175836380296359503289678772223830103177744618018883025803258327256687406
        );

        vk.IC[25] = Pairing.G1Point(
            8397350471530151972463810941539235606086258406954526704957458659889110597164,
            18619678220471645118400912559060396310227095241324996845404332354319999198988
        );

        vk.IC[26] = Pairing.G1Point(
            4232527691538139375507463951561828769485123236480968421402897242256613017100,
            19678596330709811800920113509694996785802586222249736560235061199800316957842
        );

    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
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