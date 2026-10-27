// 选座预约·分楼层房间平面图配置
// 两层两个房间：F1 一楼 / F2 二楼。每张桌画出独立座位（椅子），可单座选择。
// 坐标均为百分比（0-100），相对房间容器。座位 id 对应真实 seats 集合（F1-A1 等）。
// 两种画法：
//   · 没有 image 的楼层（F1）：用色块画桌子 / 装饰 / 座位，座位统一 SEAT_W × SEAT_H。
//   · 有 image 的楼层（F2）：整张手绘俯视底图铺满容器，座位是叠在图上的透明热区，
//     每个热区自带 w / h，位置按底图里「桌垫 + 椅子」量出来；aspect 是容器高宽比（高 / 宽 × 100），
//     必须和底图的像素比一致，否则热区会对不上图。
// 后续换底图，只改这个文件里的 image / aspect / seats 坐标。

const SEAT_W = 10;
const SEAT_H = 8;
// 底图楼层坐在椅子上的头像数量（/assets/map/seat-avatar-01.png … -10.png），按座位顺序轮流分配，邻座不重样
const AVATAR_COUNT = 10;
// 没有底图的楼层，房间容器高宽比（高 / 宽 × 100）
const DEFAULT_ASPECT = 116;

const FLOORS = [
  {
    key: 'F1',
    label: '一楼',
    subtitle: '窗边·主厅',
    decor: [
      { key: 'window', label: '落地窗', x: 4, y: 4, w: 92, h: 7, tone: 'window' },
      { key: 'bar', label: '吧台', x: 6, y: 80, w: 28, h: 13, tone: 'bar' },
      { key: 'entry', label: '入口', x: 72, y: 84, w: 22, h: 9, tone: 'entry' },
    ],
    tables: [
      {
        code: 'F1-A', name: '左墙长桌', type: 'multi',
        x: 9, y: 20, w: 15, h: 52,
        seats: [
          { id: 'F1-A1', index: 1, x: 26, y: 21 },
          { id: 'F1-A2', index: 2, x: 26, y: 30 },
          { id: 'F1-A3', index: 3, x: 26, y: 39 },
          { id: 'F1-A4', index: 4, x: 26, y: 48 },
          { id: 'F1-A5', index: 5, x: 26, y: 57 },
          { id: 'F1-A6', index: 6, x: 26, y: 66 },
        ],
      },
      {
        code: 'F1-B', name: '窗边双人', type: 'double',
        x: 64, y: 18, w: 22, h: 11,
        seats: [
          { id: 'F1-B1', index: 1, x: 65, y: 31 },
          { id: 'F1-B2', index: 2, x: 77, y: 31 },
        ],
      },
      {
        code: 'F1-C', name: '中央长桌', type: 'multi',
        x: 41, y: 46, w: 33, h: 12,
        seats: [
          { id: 'F1-C1', index: 1, x: 42, y: 37 },
          { id: 'F1-C2', index: 2, x: 53, y: 37 },
          { id: 'F1-C3', index: 3, x: 64, y: 37 },
          { id: 'F1-C4', index: 4, x: 42, y: 59 },
          { id: 'F1-C5', index: 5, x: 53, y: 59 },
          { id: 'F1-C6', index: 6, x: 64, y: 59 },
        ],
      },
    ],
  },
  {
    key: 'F2',
    label: '二楼',
    subtitle: '活动·包场',
    // 手绘俯视底图 981×1416（宽×高），容器高宽比 = 1416 / 981 = 144.3%
    image: '/assets/map/f2-room.jpg',
    aspect: 144.3,
    // 窗户、净化器、充电宝，以及底墙的豆架、红色工具车都画在底图里，不再叠色块
    decor: [],
    tables: [
      {
        code: 'F2-A', name: '左墙单人位', type: 'multi',
        x: 4.4, y: 16.2, w: 16.9, h: 46.5,
        // 椅子统一在桌垫右侧（靠房间中心）；下桌因透视整体偏左，不能靠桌心自动判断
        chair: 'right',
        seats: [
          // 上桌 3 座（椅子在桌子右侧，面朝墙上的豆瓶架）
          { id: 'F2-A1', index: 1, x: 10.7, y: 16.2, w: 10.6, h: 5.6 },
          { id: 'F2-A2', index: 2, x: 9.6, y: 22.1, w: 10.9, h: 6.0 },
          { id: 'F2-A3', index: 3, x: 8.5, y: 28.7, w: 11.0, h: 5.9 },
          // 下桌 3 座
          { id: 'F2-A4', index: 4, x: 7.0, y: 40.9, w: 11.1, h: 6.1 },
          { id: 'F2-A5', index: 5, x: 5.8, y: 48.1, w: 11.3, h: 6.6 },
          { id: 'F2-A6', index: 6, x: 4.4, y: 55.8, w: 11.5, h: 6.9 },
        ],
      },
      {
        code: 'F2-B', name: '右墙单人位', type: 'multi',
        x: 79.9, y: 16.2, w: 17.8, h: 54.9,
        // 椅子统一在桌垫左侧
        chair: 'left',
        seats: [
          // 上桌 3 座（椅子在桌子左侧）
          { id: 'F2-B1', index: 1, x: 79.9, y: 16.2, w: 10.7, h: 5.7 },
          { id: 'F2-B2', index: 2, x: 80.8, y: 22.2, w: 10.8, h: 6.0 },
          { id: 'F2-B3', index: 3, x: 81.9, y: 28.8, w: 11.0, h: 6.0 },
          // 下桌 4 座
          { id: 'F2-B4', index: 4, x: 82.9, y: 41.3, w: 11.2, h: 6.2 },
          { id: 'F2-B5', index: 5, x: 83.8, y: 48.4, w: 11.6, h: 6.5 },
          { id: 'F2-B6', index: 6, x: 84.8, y: 56.0, w: 11.7, h: 6.9 },
          { id: 'F2-B7', index: 7, x: 85.8, y: 64.0, w: 11.9, h: 7.1 },
        ],
      },
      {
        code: 'F2-C', name: '中央大桌', type: 'multi',
        x: 35.4, y: 26.7, w: 30.2, h: 31.8,
        seats: [
          // 左侧 4 座（从上到下）
          { id: 'F2-C1', index: 1, x: 36.3, y: 26.7, w: 10.2, h: 7.0 },
          { id: 'F2-C2', index: 2, x: 36.1, y: 34.7, w: 10.3, h: 7.2 },
          { id: 'F2-C3', index: 3, x: 35.8, y: 43.2, w: 10.6, h: 7.3 },
          { id: 'F2-C4', index: 4, x: 35.4, y: 52.1, w: 10.8, h: 6.4 },
          // 右侧 4 座（从上到下）
          { id: 'F2-C5', index: 5, x: 54.6, y: 26.7, w: 10.3, h: 7.0 },
          { id: 'F2-C6', index: 6, x: 54.8, y: 34.7, w: 10.5, h: 7.2 },
          { id: 'F2-C7', index: 7, x: 54.8, y: 43.2, w: 10.6, h: 7.3 },
          { id: 'F2-C8', index: 8, x: 54.9, y: 52.1, w: 10.7, h: 6.4 },
        ],
      },
    ],
  },
];

function toSet(value) {
  return value instanceof Set ? value : new Set(value || []);
}

function getFloors() {
  return FLOORS.map((f) => ({ key: f.key, label: f.label, subtitle: f.subtitle }));
}

function getFloor(floorKey) {
  return FLOORS.find((f) => f.key === floorKey) || FLOORS[0];
}

function allSeatIds() {
  const ids = [];
  for (const floor of FLOORS) {
    for (const table of floor.tables) {
      for (const seat of table.seats) ids.push(seat.id);
    }
  }
  return ids;
}

function getSeatMeta(seatId) {
  for (const floor of FLOORS) {
    for (const table of floor.tables) {
      const seat = table.seats.find((s) => s.id === seatId);
      if (seat) {
        return {
          id: seat.id,
          index: seat.index,
          floorKey: floor.key,
          floorLabel: floor.label,
          tableCode: table.code,
          tableName: table.name,
          type: table.type,
        };
      }
    }
  }
  return null;
}

function resolveSeatStatus(seatId, { fullSet, maintenanceSet, selectedSet }) {
  if (selectedSet.has(seatId)) return 'selected';
  if (maintenanceSet.has(seatId)) return 'maintenance';
  if (fullSet.has(seatId)) return 'full';
  return 'available';
}

// 生成当前楼层的渲染数据：底图 + 桌 + 座位（带状态/选中）+ 装饰
function buildFloorView({
  floorKey,
  fullSet = new Set(),
  maintenanceSet = new Set(),
  selectedSet = new Set(),
} = {}) {
  const floor = getFloor(floorKey);
  const full = toSet(fullSet);
  const maint = toSet(maintenanceSet);
  const selected = toSet(selectedSet);
  let seatOrdinal = 0;
  const tables = floor.tables.map((table) => {
    const tableCenter = table.x + table.w / 2;
    return {
      code: table.code,
      name: table.name,
      type: table.type,
      x: table.x,
      y: table.y,
      w: table.w,
      h: table.h,
      seats: table.seats.map((seat) => {
        const w = seat.w || SEAT_W;
        const avatar = String((seatOrdinal % AVATAR_COUNT) + 1).padStart(2, '0');
        seatOrdinal += 1;
        // 椅子在热区哪一侧：桌子显式指定优先（靠墙桌）；否则按座位在桌心哪一边判断（中央大桌两排）
        const chair = table.chair || (seat.x + w / 2 > tableCenter ? 'right' : 'left');
        return {
          id: seat.id,
          index: seat.index,
          x: seat.x,
          y: seat.y,
          w,
          h: seat.h || SEAT_H,
          // 底图热区 = 桌垫 + 椅子：图标放在桌垫一侧，朝向按椅子一侧定
          mat: chair === 'right' ? 'left' : 'right',
          chair,
          avatar,
          status: resolveSeatStatus(seat.id, { fullSet: full, maintenanceSet: maint, selectedSet: selected }),
          selected: selected.has(seat.id),
        };
      }),
    };
  });
  const seats = [];
  tables.forEach((t) => t.seats.forEach((s) => seats.push({ ...s, tableCode: t.code })));
  return {
    key: floor.key,
    label: floor.label,
    subtitle: floor.subtitle,
    image: floor.image || '',
    aspect: floor.aspect || DEFAULT_ASPECT,
    decor: floor.decor.slice(),
    tables,
    seats,
  };
}

module.exports = {
  SEAT_W,
  SEAT_H,
  AVATAR_COUNT,
  DEFAULT_ASPECT,
  FLOORS,
  getFloors,
  getFloor,
  allSeatIds,
  getSeatMeta,
  resolveSeatStatus,
  buildFloorView,
};
