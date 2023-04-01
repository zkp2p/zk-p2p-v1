//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
            // Use “invalid” to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "pairing-add-failed");
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
            // Use “invalid” to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success, "pairing-mul-failed");
    }
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
        require(p1.length == p2.length, "pairing-lengths-failed");
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
            // Use “invalid” to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success, "pairing-opcode-failed");
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
            [4961495125430001653774230764021047633554316218315333296970230857128232029841,
             8684242026845085711242390365364674219641234603161426893415889293355555607523],
            [5563154654116321645714652569595062268766479044720332209841755082317563779131,
             3428305023478989623590503621134858754501612508260582558883762536897076212249]
        );
        vk.IC = new Pairing.G1Point[](28);
        
        vk.IC[0] = Pairing.G1Point( 
            6465732224506635081434017192019656434828001509319886140978448431023714693843,
            7615277475185113917861365319742349327382697992945516855345716044611364213854
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            21015410426426934562411413040505125045413800588575912306181774066038129751268,
            13077230408588149327297655770549473235042931010892519275887860907164688395648
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            6116131528451433257398171582911733986595718733553787963533755047467502474447,
            17051828026610334051086766486466153289654753705311500277319873390140967478540
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            11659607426468006918321944380854039803307799207228165317694607477806406626528,
            19472179143092192867561748753129835031251203496997205703907083509649083285741
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            13232301051704492625019879313222220802925964054264538756514821149945962357551,
            10485908471110638227731689184954632638339596163979855672838253534999286218387
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            3564502636861079352272055448256367393987664971521106292614774782300964012342,
            6710450235957391519849912082297714220599790917028851868736174151351695987934
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            13087577376683782203648228708185834197857232057370787272582490693213897377008,
            7894471290167129056051038853088225692445166232855516480270462150759665805158
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            20530472261660814560306680272072453326240849032805144891655254936697075862777,
            1905125936124748349974536586081154507493352673622091697832643592458316608004
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            4748902577386421590985076007805394380879667800231450780213507952451234660891,
            21648618719410414599012012447519665239432217371339251779922422849649076805005
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            5006746842769444981849446714642022823199636688135634553296534999262370722204,
            10267303005889075351713616755808096455982695563280428882310182752381840311148
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            13360870179188075968680452697815339746786082163834356482561622334078394715825,
            16865656595208633947214640832820309389792734459578572485789300251255958535404
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            15133652148668828055043924866396080505661370521704140920236447234363780979843,
            910670210206805825745208229972607014486855474690602931976874432067962197901
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            2121433214229835739379698538474844108546431104056080286171586319411479329089,
            3339017076714409158542651250860576180874753607757717994856346827742066109833
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            4862445709593054770188386463082292904880636388948840674197277482975265638619,
            7700161294429128544279730947089901280125325878991791825458789097101678451744
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            6817899344081192940554903084439638783100682542746320905577884832341857727338,
            14227468627240714741121351382910728920830573709250842986613973150935655574934
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            18321670004866138708486954786576864483239860985866959931918931990542865968195,
            16987732722312225255805300183703135808016672946621270876485194539607406390023
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            6045496795441878383428252570506434456337695674539770174857622952027899318008,
            1718728463334516062620103847067107004713034778148789480236699527727078873990
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            4698026845320336631199193366695505859852047806285523829487132106494727945315,
            346648395071520516390327421836300058963796746648161338676227549286938012509
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            16998833985777193655120282325753779909187603948136653170661376206720463377792,
            19765421715273913408527813352047473739524618533003494799426912485586154188298
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20076839029201037905076413072474642921376952802115509771790934860495691039782,
            3563064401216355011659199875287283121129599752170407253161212864430462577799
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            20449565006556470504770142492305958097616395162155914207868237209868665143231,
            15232180950176477992318734335623781646483971807600978517482989703883027353213
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            4805575354841781913262345138172375125851352826817052861837826659981154975653,
            2557661049590489997479316238766262689469478762042263495404646562025320603298
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            11626575984253463027009391268728603544617583956988393331208539385012764434728,
            8777203817620121375205446834478369661220880377718376875626780604826882995174
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            12609280477744601246153946115178241871841588045839404140241442019619965729728,
            14713179148200036058918940756091009451722310095628438749548521356568414812026
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            8949610815505325388541467202981894959538939617619984295354061815635106090989,
            11762380594279356012180765793560893399013227082653854793480158212760599146052
        );                                      
        
        vk.IC[25] = Pairing.G1Point( 
            8661877617141325463630588284226698405750923336804608422659080485178986532621,
            8012160362908388309239294896380474415930423525452538663561379943591435109571
        );                                      
        
        vk.IC[26] = Pairing.G1Point( 
            6423793323216809982765488343831857749923904059105712749909489674605939176694,
            16739725423736583419914606539810845218555440546887392309040968776566993983515
        );                                      
        
        vk.IC[27] = Pairing.G1Point( 
            18213079228210314881541352902910544881656573469424772450492813922304720568078,
            5536492494036057209997442318547581689982831812148215272912025227149663759612
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length, "verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field, "verifier-gte-snark-scalar-field");
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
            uint[27] memory input
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
