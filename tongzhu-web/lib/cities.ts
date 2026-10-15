// Chongqing updated to 2026 city government divisions (37 districts/counties).
// https://www.cq.gov.cn/zjcq/sqgk/cqsq/202601/t20260125_15350959.html
// District snapshot: modood/Administrative-divisions-of-China; Shenzhen also includes Dapeng New Area.
export const CITY_CONFIG:Record<string,{districts:string[];lat:number;lng:number}>={
  "上海": {
    "districts": [
      "黄浦区",
      "徐汇区",
      "长宁区",
      "静安区",
      "普陀区",
      "虹口区",
      "杨浦区",
      "闵行区",
      "宝山区",
      "嘉定区",
      "浦东新区",
      "金山区",
      "松江区",
      "青浦区",
      "奉贤区",
      "崇明区"
    ],
    "lat": 31.2304,
    "lng": 121.4737
  },
  "北京": {
    "districts": [
      "东城区",
      "西城区",
      "朝阳区",
      "丰台区",
      "石景山区",
      "海淀区",
      "门头沟区",
      "房山区",
      "通州区",
      "顺义区",
      "昌平区",
      "大兴区",
      "怀柔区",
      "平谷区",
      "密云区",
      "延庆区"
    ],
    "lat": 39.9042,
    "lng": 116.4074
  },
  "深圳": {
    "districts": [
      "罗湖区",
      "福田区",
      "南山区",
      "宝安区",
      "龙岗区",
      "盐田区",
      "龙华区",
      "坪山区",
      "光明区",
      "大鹏新区"
    ],
    "lat": 22.5431,
    "lng": 114.0579
  },
  "杭州": {
    "districts": [
      "上城区",
      "拱墅区",
      "西湖区",
      "滨江区",
      "萧山区",
      "余杭区",
      "富阳区",
      "临安区",
      "临平区",
      "钱塘区",
      "桐庐县",
      "淳安县",
      "建德市"
    ],
    "lat": 30.2741,
    "lng": 120.1551
  },
  "广州": {
    "districts": [
      "荔湾区",
      "越秀区",
      "海珠区",
      "天河区",
      "白云区",
      "黄埔区",
      "番禺区",
      "花都区",
      "南沙区",
      "从化区",
      "增城区"
    ],
    "lat": 23.1291,
    "lng": 113.2644
  },
  "成都": {
    "districts": [
      "锦江区",
      "青羊区",
      "金牛区",
      "武侯区",
      "成华区",
      "龙泉驿区",
      "青白江区",
      "新都区",
      "温江区",
      "双流区",
      "郫都区",
      "新津区",
      "金堂县",
      "大邑县",
      "蒲江县",
      "都江堰市",
      "彭州市",
      "邛崃市",
      "崇州市",
      "简阳市"
    ],
    "lat": 30.5728,
    "lng": 104.0668
  },
  "重庆": {
    "districts": [
      "万州区",
      "涪陵区",
      "渝中区",
      "大渡口区",
        "沙坪坝区",
      "九龙坡区",
      "南岸区",
      "北碚区",
      "綦江区",
      "大足区",
      "两江新区",
      "巴南区",
      "黔江区",
      "长寿区",
      "江津区",
      "合川区",
      "永川区",
      "南川区",
      "璧山区",
      "铜梁区",
      "潼南区",
      "荣昌区",
      "开州区",
      "梁平区",
      "武隆区",
      "城口县",
      "丰都县",
      "垫江县",
      "忠县",
      "云阳县",
      "奉节县",
      "巫山县",
      "巫溪县",
      "石柱土家族自治县",
      "秀山土家族苗族自治县",
      "酉阳土家族苗族自治县",
      "彭水苗族土家族自治县"
    ],
    "lat": 29.563,
    "lng": 106.5516
  },
  "贵阳": {
    "districts": [
      "南明区",
      "云岩区",
      "花溪区",
      "乌当区",
      "白云区",
      "观山湖区",
      "开阳县",
      "息烽县",
      "修文县",
      "清镇市"
    ],
    "lat": 26.647,
    "lng": 106.6302
  }
};
export const CITIES=Object.keys(CITY_CONFIG);
export const DEFAULT_CITY='贵阳';
export function cityInfo(city:string){return CITY_CONFIG[city]||CITY_CONFIG[DEFAULT_CITY]}
export function districtsFor(city:string){return ['全部区域',...cityInfo(city).districts]}
export function cityMapUrl(city:string){const {lat,lng}=cityInfo(city);return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-.18},${lat-.12},${lng+.18},${lat+.12}&layer=mapnik`}
