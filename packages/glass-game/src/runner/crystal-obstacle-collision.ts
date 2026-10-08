// Crystal obstacle contact profiles — conservative convex sections measured from the shipped GLB surfaces.

import type { RunnerBlockerCollisionProfile } from './contracts.ts'

// B01 geometry source SHA-256 (lossless runtime packing in runner-obstacles-v1/provenance.json): 8449c0c0b3453570d18c4369124b17c72790aef055822d2fff4c894e05bca09f
export const CRYSTAL_BULWARK_COLLISION = {
  kind: 'convex-yz',
  vertices: [
    {
      zFraction: -0.5,
      yFraction: 0.0,
    },
    {
      zFraction: 0.5,
      yFraction: 0.0,
    },
    {
      zFraction: 0.5,
      yFraction: 0.045219024110493715,
    },
    {
      zFraction: 0.49939772486686707,
      yFraction: 0.1928765687610624,
    },
    {
      zFraction: 0.49680032987839096,
      yFraction: 0.3044292767428934,
    },
    {
      zFraction: 0.48465462129668774,
      yFraction: 0.46266461481878385,
    },
    {
      zFraction: 0.4379334189717327,
      yFraction: 0.6671806435625198,
    },
    {
      zFraction: 0.3324190207735116,
      yFraction: 0.8594092017871501,
    },
    {
      zFraction: 0.13257819312416524,
      yFraction: 1.0,
    },
    {
      zFraction: -0.12335779366206978,
      yFraction: 1.0,
    },
    {
      zFraction: -0.32767951552488583,
      yFraction: 0.8680437414916731,
    },
    {
      zFraction: -0.4379334189717328,
      yFraction: 0.6671806435625194,
    },
    {
      zFraction: -0.48465462129668774,
      yFraction: 0.46266461481878396,
    },
    {
      zFraction: -0.49680032987839096,
      yFraction: 0.30442927674289333,
    },
    {
      zFraction: -0.4993977248668671,
      yFraction: 0.19287656876106019,
    },
    {
      zFraction: -0.5,
      yFraction: 0.04521902411049439,
    },
  ],
} as const satisfies RunnerBlockerCollisionProfile

// J01 geometry source SHA-256 (lossless runtime packing in runner-obstacles-v1/provenance.json): 337e8dd1498a9f1d74b5fd8afb2fa7495b1743b50d874db17984d44c5d37dc7c
export const ROSE_HURDLE_COLLISION = {
  kind: 'convex-yz-bands',
  bands: [
    {
      minXFraction: -0.5,
      maxXFraction: -0.375,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.044375843134120775,
        },
        {
          zFraction: 0.4993977248668672,
          yFraction: 0.13024630280989913,
        },
        {
          zFraction: 0.49678191808204647,
          yFraction: 0.24032606970366083,
        },
        {
          zFraction: 0.48455810053631004,
          yFraction: 0.4076201803834896,
        },
        {
          zFraction: 0.4409451966137369,
          yFraction: 0.620554397952828,
        },
        {
          zFraction: 0.3180674064965977,
          yFraction: 0.8712267732865893,
        },
        {
          zFraction: 0.1387960289516581,
          yFraction: 0.9992222997810364,
        },
        {
          zFraction: -0.13935491584562643,
          yFraction: 0.9992222997810364,
        },
        {
          zFraction: -0.3182448989023183,
          yFraction: 0.870978422191699,
        },
        {
          zFraction: -0.44093696655227044,
          yFraction: 0.6204804928072458,
        },
        {
          zFraction: -0.48453999460791997,
          yFraction: 0.40776122814982285,
        },
        {
          zFraction: -0.49677801575427777,
          yFraction: 0.24040274007677198,
        },
        {
          zFraction: -0.4993977248668671,
          yFraction: 0.13024630280990357,
        },
        {
          zFraction: -0.5,
          yFraction: 0.04437584313411935,
        },
      ],
    },
    {
      minXFraction: -0.375,
      maxXFraction: -0.215,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.02579999598522485,
        },
        {
          zFraction: 0.4993977248668671,
          yFraction: 0.13034348818320476,
        },
        {
          zFraction: 0.4967780148613618,
          yFraction: 0.24058625886809687,
        },
        {
          zFraction: 0.48453998898612904,
          yFraction: 0.4080758144085144,
        },
        {
          zFraction: 0.4368790238917142,
          yFraction: 0.6407741107990919,
        },
        {
          zFraction: 0.3005120184784576,
          yFraction: 0.8882217596589914,
        },
        {
          zFraction: 0.14928059366038926,
          yFraction: 1.0,
        },
        {
          zFraction: -0.054964027006045635,
          yFraction: 1.0,
        },
        {
          zFraction: -0.27686482926651373,
          yFraction: 0.9311312695870568,
        },
        {
          zFraction: -0.436879023891714,
          yFraction: 0.6407741107990921,
        },
        {
          zFraction: -0.48453998898612904,
          yFraction: 0.40807581440851415,
        },
        {
          zFraction: -0.49677801486136186,
          yFraction: 0.24058625886809615,
        },
        {
          zFraction: -0.49939772486686707,
          yFraction: 0.13034348818320862,
        },
        {
          zFraction: -0.5,
          yFraction: 0.0257999959852242,
        },
      ],
    },
    {
      minXFraction: -0.215,
      maxXFraction: -0.13,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.025799995985222417,
        },
        {
          zFraction: 0.49939772486686707,
          yFraction: 0.1268404338027935,
        },
        {
          zFraction: 0.49677801661440263,
          yFraction: 0.2339725460997416,
        },
        {
          zFraction: 0.4845399943698889,
          yFraction: 0.3967363034238758,
        },
        {
          zFraction: 0.4409370119793112,
          yFraction: 0.6036151018626961,
        },
        {
          zFraction: 0.3354167491394827,
          yFraction: 0.8131393372960082,
        },
        {
          zFraction: 0.13396244081143616,
          yFraction: 0.9719589564468384,
        },
        {
          zFraction: -0.132876581142924,
          yFraction: 0.9719589564468384,
        },
        {
          zFraction: -0.3338126360013096,
          yFraction: 0.8152208261561943,
        },
        {
          zFraction: -0.4401340130896446,
          yFraction: 0.6063328574541005,
        },
        {
          zFraction: -0.484309223363119,
          yFraction: 0.3989516094688237,
        },
        {
          zFraction: -0.49673232382473104,
          yFraction: 0.23547014045167602,
        },
        {
          zFraction: -0.49939160719141373,
          yFraction: 0.12786676308691136,
        },
        {
          zFraction: -0.5,
          yFraction: 0.02579999598522409,
        },
      ],
    },
    {
      minXFraction: -0.13,
      maxXFraction: 0.0,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.025799995985225952,
        },
        {
          zFraction: 0.4993977248668671,
          yFraction: 0.1213022607829056,
        },
        {
          zFraction: 0.49677801646524183,
          yFraction: 0.22351660944578955,
        },
        {
          zFraction: 0.48453999531006564,
          yFraction: 0.3788090230242383,
        },
        {
          zFraction: 0.4409368449588437,
          yFraction: 0.5761920619987944,
        },
        {
          zFraction: 0.33541613333996045,
          yFraction: 0.7760982855228314,
        },
        {
          zFraction: 0.13396224328193734,
          yFraction: 0.9276268694068909,
        },
        {
          zFraction: -0.13323149131923562,
          yFraction: 0.9276268694068909,
        },
        {
          zFraction: -0.33433547439561434,
          yFraction: 0.7774402399979982,
        },
        {
          zFraction: -0.4403958056630217,
          yFraction: 0.5779456378994761,
        },
        {
          zFraction: -0.4843845223529355,
          yFraction: 0.3802375090789363,
        },
        {
          zFraction: -0.49674723102892027,
          yFraction: 0.22448301432921158,
        },
        {
          zFraction: -0.49939353971997147,
          yFraction: 0.12196589603041097,
        },
        {
          zFraction: -0.5,
          yFraction: 0.0257999959852242,
        },
      ],
    },
    {
      minXFraction: 0.0,
      maxXFraction: 0.13,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.025799995985222545,
        },
        {
          zFraction: 0.49939772486686707,
          yFraction: 0.12115780892629754,
        },
        {
          zFraction: 0.4967940579409883,
          yFraction: 0.22294925701987664,
        },
        {
          zFraction: 0.4846157077153947,
          yFraction: 0.3777948030352111,
        },
        {
          zFraction: 0.44119596623206403,
          yFraction: 0.5747416929031595,
        },
        {
          zFraction: 0.3353274116124799,
          yFraction: 0.7757096916406122,
        },
        {
          zFraction: 0.13326302421705344,
          yFraction: 0.9264705989028931,
        },
        {
          zFraction: -0.13396266910208132,
          yFraction: 0.9264705989028931,
        },
        {
          zFraction: -0.33541663548905165,
          yFraction: 0.7751314654109804,
        },
        {
          zFraction: -0.4409369417549106,
          yFraction: 0.5754763644366077,
        },
        {
          zFraction: -0.4845399902781298,
          yFraction: 0.3783414031104477,
        },
        {
          zFraction: -0.496778016666772,
          yFraction: 0.22324390606215438,
        },
        {
          zFraction: -0.49939772486686707,
          yFraction: 0.12115780892629513,
        },
        {
          zFraction: -0.5,
          yFraction: 0.02579999598522409,
        },
      ],
    },
    {
      minXFraction: 0.13,
      maxXFraction: 0.215,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.02579999598522435,
        },
        {
          zFraction: 0.49939772486686707,
          yFraction: 0.12655836972255663,
        },
        {
          zFraction: 0.4967974429891684,
          yFraction: 0.23306641239534354,
        },
        {
          zFraction: 0.48463152848136987,
          yFraction: 0.3951306879237247,
        },
        {
          zFraction: 0.44125022560628185,
          yFraction: 0.6012880275922527,
        },
        {
          zFraction: 0.33513724546941936,
          yFraction: 0.8123260506127107,
        },
        {
          zFraction: 0.1328400378984217,
          yFraction: 0.9697010728981018,
        },
        {
          zFraction: -0.1339625501439914,
          yFraction: 0.9697010728981018,
        },
        {
          zFraction: -0.3354166106195446,
          yFraction: 0.8112527922009083,
        },
        {
          zFraction: -0.4409369129207342,
          yFraction: 0.6022187735458108,
        },
        {
          zFraction: -0.48453998560376615,
          yFraction: 0.395823304362215,
        },
        {
          zFraction: -0.49677801574499697,
          yFraction: 0.23344001961905148,
        },
        {
          zFraction: -0.4993977248668671,
          yFraction: 0.12655836972255263,
        },
        {
          zFraction: -0.5,
          yFraction: 0.0257999959852242,
        },
      ],
    },
    {
      minXFraction: 0.215,
      maxXFraction: 0.375,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.02579999598522485,
        },
        {
          zFraction: 0.4993977248668671,
          yFraction: 0.13034348818320474,
        },
        {
          zFraction: 0.4967780148613618,
          yFraction: 0.24058625886809684,
        },
        {
          zFraction: 0.48453998898612904,
          yFraction: 0.4080758144085143,
        },
        {
          zFraction: 0.4368790238917141,
          yFraction: 0.640774110799092,
        },
        {
          zFraction: 0.30051201847845765,
          yFraction: 0.8882217596589913,
        },
        {
          zFraction: 0.1492805936603892,
          yFraction: 1.0,
        },
        {
          zFraction: -0.06238309744284076,
          yFraction: 1.0,
        },
        {
          zFraction: -0.2809956885137518,
          yFraction: 0.923635531117164,
        },
        {
          zFraction: -0.436879023891714,
          yFraction: 0.6407741107990921,
        },
        {
          zFraction: -0.48453998898612904,
          yFraction: 0.40807581440851415,
        },
        {
          zFraction: -0.49677801486136186,
          yFraction: 0.24058625886809615,
        },
        {
          zFraction: -0.49939772486686707,
          yFraction: 0.13034348818320862,
        },
        {
          zFraction: -0.5,
          yFraction: 0.0257999959852242,
        },
      ],
    },
    {
      minXFraction: 0.375,
      maxXFraction: 0.5,
      vertices: [
        {
          zFraction: -0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.0,
        },
        {
          zFraction: 0.5,
          yFraction: 0.044375843134117965,
        },
        {
          zFraction: 0.49939772486686707,
          yFraction: 0.13023049267787895,
        },
        {
          zFraction: 0.4967780160006684,
          yFraction: 0.24037288651072844,
        },
        {
          zFraction: 0.48453998789347946,
          yFraction: 0.4077100851073857,
        },
        {
          zFraction: 0.44093691791454975,
          yFraction: 0.6204024826946533,
        },
        {
          zFraction: 0.31841611663083325,
          yFraction: 0.8705183346596362,
        },
        {
          zFraction: 0.14036856247701973,
          yFraction: 0.9990956995155335,
        },
        {
          zFraction: -0.13980590834683426,
          yFraction: 0.9990956995155335,
        },
        {
          zFraction: -0.31822191159515506,
          yFraction: 0.8707827541850339,
        },
        {
          zFraction: -0.44086551933121365,
          yFraction: 0.6206533487643022,
        },
        {
          zFraction: -0.484519518592718,
          yFraction: 0.40791430243554216,
        },
        {
          zFraction: -0.49677395346685904,
          yFraction: 0.24051065431487872,
        },
        {
          zFraction: -0.4993970000662945,
          yFraction: 0.1303338133958083,
        },
        {
          zFraction: -0.5,
          yFraction: 0.04437584313411935,
        },
      ],
    },
  ],
} as const satisfies RunnerBlockerCollisionProfile
