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
        vk.IC = new Pairing.G1Point[](27);

        vk.IC[0] = Pairing.G1Point(
            11080296110693363988379919657543411083075096416291909592510078391096160111340,
            7371329861306731807405789159915809682098340789406614404523845239543527629285
        );

        vk.IC[1] = Pairing.G1Point(
            9660923026415619522329334865010845635470173203694506678288268862719525606986,
            8245510319833478657991069313714260203745827651388888564208528871159820440652
        );

        vk.IC[2] = Pairing.G1Point(
            16731241153820308617364143293533683119609446443790988486213565098948545077371,
            18917260634299489932133386348278057474201778337089654446936203407644286962157
        );

        vk.IC[3] = Pairing.G1Point(
            8987402238040621658361651673257173043047210652340128993228019402859099801879,
            6412750105602373196897375254284133894400700394955816698843591890913319120176
        );

        vk.IC[4] = Pairing.G1Point(
            10847101638557287857185397666927095246422048439443180528200386596073404396194,
            21829493167786457796190890213774092163752735863518957745365613985627991738844
        );

        vk.IC[5] = Pairing.G1Point(
            13745218481931073309159783874696950764807795327147043266981902771175124118818,
            21687185003450665792602536944753370737684173219776621331762764134729691764349
        );

        vk.IC[6] = Pairing.G1Point(
            6190915580003604840453748429729579286462314185739435629032510675194329723106,
            2390271978530208500611240981005895844645443706102092730839271866922879227935
        );

        vk.IC[7] = Pairing.G1Point(
            13656180902751764481204987271461655440741125381085025674322182373964173476201,
            1167260913116281601198060460921958200295854555575153177492959501405091107210
        );

        vk.IC[8] = Pairing.G1Point(
            11267100610993458157899212048388350877358850671290150606609582412036495389354,
            21378059978250788820031511996652610487925706497255230993209433958175490960180
        );

        vk.IC[9] = Pairing.G1Point(
            8214415307326262192816049751714768335659666325781459769165579687842342858509,
            15387412625255429286172710627703464165222902041932386309469893611636989823615
        );

        vk.IC[10] = Pairing.G1Point(
            4386925279955948430396377645630836370453770940125948286562168856907044070415,
            11909081967695439147706689533630477892076982060821345223228350366566269378251
        );

        vk.IC[11] = Pairing.G1Point(
            9803630026322434532326529924738040224202882743681958955707058287737215231191,
            21772113689562338978301591481793595261794638652688472841870695794728520095777
        );

        vk.IC[12] = Pairing.G1Point(
            4868119744699958268830245165243638117680282947701053324093296361903385339329,
            15581339665544620234065758695168176868898488176005284627707480075445697844022
        );

        vk.IC[13] = Pairing.G1Point(
            3929407417242893592478664260646883743811455514088852419679163864920233673558,
            2460154445850577305264828645150176770273807769889300582280803707723333581173
        );

        vk.IC[14] = Pairing.G1Point(
            12508118820206910950058425578267350617172124674865182106759647574833637583710,
            15185370678944789426828749447722347720051839683523072952542612558096765691644
        );

        vk.IC[15] = Pairing.G1Point(
            20013127082833860360302791443207835525631055447579102412790041369771051209969,
            6603709092438841662845034093772166328047059077055100760346534224626444164164
        );

        vk.IC[16] = Pairing.G1Point(
            7876707617338334932824288560806299392667629357676773821550930456177555779366,
            14278628586377039557335756488326244262081965414170670644801704201617147077840
        );

        vk.IC[17] = Pairing.G1Point(
            1367344225511034270576660318176468140372186230220531537326206669261093683848,
            20432901756180341688576228449418898920380686419504297337166662098605565528545
        );

        vk.IC[18] = Pairing.G1Point(
            2708404148959529996521639701722875250987849699800970625300856648756390114592,
            8724320234328983485137867300909031093081618203175612684967298127173697794610
        );

        vk.IC[19] = Pairing.G1Point(
            956711266234496873078410370077513920332006736719916750471645312462521687399,
            6215117296658900906300393026442432074732352765068830038202923630548886371992
        );

        vk.IC[20] = Pairing.G1Point(
            15737001283819547374879576266637039696704293192434246770323381119976876320247,
            9021617131078696722194821921021204216137050433634848658639647157672639938256
        );

        vk.IC[21] = Pairing.G1Point(
            1229142686126222073452794411223253159327138171392070263706290095465427001412,
            14718320078829053520903626023474116717590408343476393413661302943892071504062
        );

        vk.IC[22] = Pairing.G1Point(
            15595189561888818333977059936150088752494082366179533266346335400964784116710,
            21139426998937916820636054295182331478821187344772550184748617629098702343315
        );

        vk.IC[23] = Pairing.G1Point(
            1725776834805350752697533018154639810049165486335258050381120933992651181429,
            15702764261768329203973837940499021214465176166109974864550798993154899924655
        );

        vk.IC[24] = Pairing.G1Point(
            12936128620770092118850081795491915669368500538794668778653291889380021012297,
            2034434498440759863733364818189059850264257637318590081683912500594742668336
        );

        vk.IC[25] = Pairing.G1Point(
            11185533825650488941892639238672188354442644418046489799901823720400578732877,
            12047127415337297769607438743539136873076792690704151339358258695041190351029
        );

        vk.IC[26] = Pairing.G1Point(
            7212150091543747941181228848424616954341623764363119736645463826241813130551,
            12641321865090909360587848999534315059165274028202714445195188026069378109916
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
