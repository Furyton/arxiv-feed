let titles_area = ["embedding", "vector", "retrieval", "generative retrieval", "differentiable search index", "generative information retrieval", "provable", "learnability", "provably", "nearest neighbor", "index"];
let titles_type = [];
// let titles_model = ["BERT", "GPT", "Transformer"];
// let titles_method = ["Contrastive Learning", "Contrastive", "Pre-train", "Pretrain", "Prompt", "Self-Supervised", "Distillation"];
let titles = titles_area + titles_type;
let authors_array = [
    "Jimmy Lin",
    "Kaifeng Lyu",
    "Zhiyuan Li",
    "Yuanzhi Li",
    "Chuan Meng",
    "Tengyu Ma",
    "Taiji Suzuki",
    "Kun Gai",
    "Jason D. Lee",
    "Zeyuan Allen-Zhu",
    "Jiafeng Guo",
    "Zhengliang Shi",
    "Lijun Zhang",
    "Weiwei Sun",
    "Luke Zettlemoyer",
    "Yongfeng Zhang",
    "Jin Huang",
    "Yubao Tang",
    "Liwei Wang",
    "Kaiyue Wen",
    "Xiangnan He",
    "Andrew Yates",
    "Zhewei Wei",
    "Qingyao Ai",
    "Weijie Su",
    "Jiaye Teng",
    "Jiaxin Mao",
    "Jun Xu",
    "Di He",
    "Tianyu Gao",
    "Danqi Chen",
    "Maarten de Rijke",
    "Zuyuan Zhang",
    "Xueguang Ma",
    "Greg Yang",
    "Charles L.A. Clarke",
    "Hamed Zamani",
    "Zhao Song",
    "Hansi Zeng",
    "Omar Khattab",
    "Jingtao Zhan",
    "Sebastian Bruch",
    "Sanjeev Arora",
    // my feed
    "Julian McAuley", "J McAuley",
    "Steffen Rendle",
    ];

let conferences = [
    // AI
    "AAAI", "AISTATS", "ALT",  "IJCAI", "STOC", "UAI",
    // CV
    // DM
    "KDD", "PODS", "RecSys","SIGMOD", "VLDB", "WSDM", "WWW",
    // IR
    "ECIR", "ICTIR", "SIGIR",
    // ML
    "AISTATS", "ICLR", "ICML","NeurIPS", "NIPS", "UAI",
    "ACL","COLT","EMNLP",
    // Arch
];

let start = conferences.shift();
let conferences_rg = conferences.reduce(|sum, v| sum + "|" + v, start);
let conferences_rg = "(" + conferences_rg + ")([\\s'-]*\\d+)?";

let start = titles.shift();
let title_rg = titles.reduce(|sum, v| sum + "|" + v, start);

let start = authors_array.shift();
let authors_rg = authors_array.reduce(|sum, v| sum + "|" + v, start);

export title_rg;
export authors_rg;
export conferences_rg;
