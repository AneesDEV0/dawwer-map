(function () {
  const GRID = 10;
  const WIDTH = 1200;
  const HEIGHT = 720;
  const COLS = Math.ceil(WIDTH / GRID);
  const ROWS = Math.ceil(HEIGHT / GRID);
  const obstacleTypes = new Set(["shelf", "wall", "freezer", "fridge", "checkout", "obstacle"]);

  function key(x, y) { return `${x},${y}`; }
  function toCell(point) {
    return {
      x: Math.max(0, Math.min(COLS - 1, Math.round(point.x / GRID))),
      y: Math.max(0, Math.min(ROWS - 1, Math.round(point.y / GRID)))
    };
  }
  function toPoint(cell) { return { x: cell.x * GRID, y: cell.y * GRID }; }

  function buildBlocked(elements, padding = 7) {
    const blocked = new Set();
    elements.filter(element => obstacleTypes.has(element.type)).forEach(element => {
      const isWall = element.type === "wall";
      const inset = isWall ? 0 : padding;
      const minX = Math.max(0, Math.floor((element.x - inset) / GRID));
      const maxX = Math.min(COLS - 1, Math.ceil((element.x + element.w + inset) / GRID));
      const minY = Math.max(0, Math.floor((element.y - inset) / GRID));
      const maxY = Math.min(ROWS - 1, Math.ceil((element.y + element.h + inset) / GRID));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) blocked.add(key(x, y));
      }
    });
    return blocked;
  }

  function nearestWalkable(cell, blocked) {
    if (!blocked.has(key(cell.x, cell.y))) return cell;
    for (let radius = 1; radius < 9; radius += 1) {
      for (let y = cell.y - radius; y <= cell.y + radius; y += 1) {
        for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
          if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
          if (!blocked.has(key(x, y))) return { x, y };
        }
      }
    }
    return cell;
  }

  function getAccessPoint(element, fromPoint, blocked) {
    const candidates = [
      { x: element.x + element.w / 2, y: element.y + element.h + GRID },
      { x: element.x + element.w / 2, y: element.y - GRID },
      { x: element.x - GRID, y: element.y + element.h / 2 },
      { x: element.x + element.w + GRID, y: element.y + element.h / 2 }
    ];
    const ranked = candidates
      .map(point => {
        const cell = nearestWalkable(toCell(point), blocked);
        const resolved = toPoint(cell);
        const approach = Math.hypot(resolved.x - fromPoint.x, resolved.y - fromPoint.y);
        const displacement = Math.hypot(resolved.x - point.x, resolved.y - point.y);
        return { point, cell, resolved, score: approach + displacement * 4 };
      })
      .filter(item => !blocked.has(key(item.cell.x, item.cell.y)))
      .sort((a, b) => a.score - b.score);
    return ranked.length ? toPoint(ranked[0].cell) : { x: element.x + element.w / 2, y: element.y + element.h + GRID };
  }

  function findPath(startPoint, endPoint, elements) {
    const blocked = buildBlocked(elements);
    const start = nearestWalkable(toCell(startPoint), blocked);
    const end = nearestWalkable(toCell(endPoint), blocked);
    blocked.delete(key(start.x, start.y));
    blocked.delete(key(end.x, end.y));

    const open = [{ ...start, g: 0, f: Math.abs(end.x - start.x) + Math.abs(end.y - start.y) }];
    const cameFrom = new Map();
    const gScore = new Map([[key(start.x, start.y), 0]]);
    const closed = new Set();
    const directions = [[1,0],[-1,0],[0,1],[0,-1]];

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const currentKey = key(current.x, current.y);
      if (current.x === end.x && current.y === end.y) {
        const path = [{ x: current.x, y: current.y }];
        let traceKey = currentKey;
        while (cameFrom.has(traceKey)) {
          const previous = cameFrom.get(traceKey);
          path.unshift(previous);
          traceKey = key(previous.x, previous.y);
        }
        return simplifyPath(path.map(toPoint));
      }
      closed.add(currentKey);
      for (const [dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const neighborKey = key(nx, ny);
        if (nx < 2 || nx >= COLS - 2 || ny < 2 || ny >= ROWS - 1 || blocked.has(neighborKey) || closed.has(neighborKey)) continue;
        const tentative = current.g + 1;
        if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
        cameFrom.set(neighborKey, { x: current.x, y: current.y });
        gScore.set(neighborKey, tentative);
        const heuristic = Math.abs(end.x - nx) + Math.abs(end.y - ny);
        const existing = open.find(node => node.x === nx && node.y === ny);
        if (existing) { existing.g = tentative; existing.f = tentative + heuristic; }
        else open.push({ x: nx, y: ny, g: tentative, f: tentative + heuristic });
      }
    }
    return [startPoint, endPoint];
  }

  function simplifyPath(points) {
    if (points.length < 3) return points;
    const simplified = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      const directionA = { x: current.x - previous.x, y: current.y - previous.y };
      const directionB = { x: next.x - current.x, y: next.y - current.y };
      if (directionA.x !== directionB.x || directionA.y !== directionB.y) simplified.push(current);
    }
    simplified.push(points[points.length - 1]);
    return simplified;
  }

  function pathDistance(points) {
    return points.slice(1).reduce((distance, point, index) => distance + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  }

  function getRoute(store, shelf) {
    const blocked = buildBlocked(store.elements);
    const accessPoint = getAccessPoint(shelf, store.entrance, blocked);
    const points = findPath(store.entrance, accessPoint, store.elements);
    return { points, accessPoint, distance: pathDistance(points) };
  }

  function getMultiStopRoute(store, shelves) {
    let current = store.entrance;
    const remaining = shelves.slice();
    const ordered = [];
    const points = [current];
    while (remaining.length) {
      remaining.sort((a, b) => {
        const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
        const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        return Math.hypot(ac.x - current.x, ac.y - current.y) - Math.hypot(bc.x - current.x, bc.y - current.y);
      });
      const shelf = remaining.shift();
      const blocked = buildBlocked(store.elements);
      const access = getAccessPoint(shelf, current, blocked);
      const segment = findPath(current, access, store.elements);
      points.push(...segment.slice(1));
      ordered.push(shelf);
      current = access;
    }
    const checkout = store.elements.find(element => element.type === "checkout");
    if (checkout) {
      const blocked = buildBlocked(store.elements);
      const checkoutAccess = getAccessPoint(checkout, current, blocked);
      points.push(...findPath(current, checkoutAccess, store.elements).slice(1));
    }
    return { points, ordered, distance: pathDistance(points) };
  }

  window.DawerNavigation = { GRID, buildBlocked, getAccessPoint, findPath, getRoute, getMultiStopRoute, pathDistance };
})();
