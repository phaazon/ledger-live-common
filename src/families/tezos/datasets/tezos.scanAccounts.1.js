// @flow

export default {
  name: "tezos seed 1",
  unstableAccounts: true, // accounts are staking so receive over time. we disable for now snapshot comparison
  apdus: `
      => 8002000009028000002c800006c1
      <= 210280ca1bdf81e50b0c09df34557084edafcc9f7e1f749fe47596405bb6d802f0029000
      => 8002000015058000002c800006c1800000008000000080000000
      <= 2102f7ed85c519f7d39a664935a410d1a41ca302dfa3eee228e92cbe0dc12aba7a189000
      => 8002000015058000002c800006c1800000008000000080000001
      <= 2102b058662fd530e6463d774e3951a40ddd5e430dbeb62673f90caca0cec58735fd9000
      => 8002000009028000002c800006c1
      <= 210280ca1bdf81e50b0c09df34557084edafcc9f7e1f749fe47596405bb6d802f0029000
      => 8002000011048000002c800006c18000000080000000
      <= 210294e8344ae6df2d3123fa100b5abd40cee339c67838b1c34c4f243cc582f4d2d89000
      => 8002000011048000002c800006c18000000080000001
      <= 2102670e5e92d06e725b68edda589678fdf0f85a582df06ee634d841cf8042db63839000
      => 8002000009028000002c800006c1
      <= 210280ca1bdf81e50b0c09df34557084edafcc9f7e1f749fe47596405bb6d802f0029000
      => 8002000015058000002c800006c1800000008000000080000000
      <= 2102f7ed85c519f7d39a664935a410d1a41ca302dfa3eee228e92cbe0dc12aba7a189000
      => 8002000015058000002c800006c1800000018000000080000000
      <= 2102c26d0da1978b7a7596c9853d80d0beac20519c73e76e7f677540db47165d94f39000
      => 8002000015058000002c800006c1800000028000000080000000
      <= 21020058c0efd324fa13d778c4b0995f6fa8d9c85e561c1465d770d4011993f557509000
      => 8002000015058000002c800006c1800000038000000080000000
      <= 21029bfe70b3e94ff23623f6c42f6e081a9ca8cc78f74b0d8da58f0d4cdc41c33c1a9000
      => 8002000015058000002c800006c1800000048000000080000000
      <= 21021d3b9b84feb81d5215cca4f0a016e99fc6cf86d06e864cb4a5098709f16aa2219000
      => 8002000015058000002c800006c1800000058000000080000000
      <= 21020162dc75ad3c2b6e097d15a1513033c60d8a033f2312ff5a6ead812228d9d6539000
      => 8002000015058000002c800006c1800000068000000080000000
      <= 21021831897c4224296519d496d32fdf9e17fb4af680635c5dbbc46cde84fe11dcc99000
      => 8002000009028000002c800006c1
      <= 210280ca1bdf81e50b0c09df34557084edafcc9f7e1f749fe47596405bb6d802f0029000
      => 8002000011048000002c800006c18000000080000000
      <= 210294e8344ae6df2d3123fa100b5abd40cee339c67838b1c34c4f243cc582f4d2d89000
      => 8002000011048000002c800006c18000000180000000
      <= 2102389ffd73423626894cb151416e51c72ec285376673daf83545eb5edb45b261ce9000
      => 8002000011048000002c800006c18000000280000000
      <= 2102e4c49994c90ffe2e5480826d2f49fb9d0f45280e20bd0a61c488f652d7af0f9c9000
      => 8002000011048000002c800006c18000000380000000
      <= 2102a9ae8b0ff5f9a43565793ad78e10db6f12177d904d208ada591b8a5b9999e3fd9000
      `,
};
