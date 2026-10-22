(() => {
  const BASE = 10; // 基本の出題数。これ以降は「解き進める」か「結果を出す」を選ぶ
  const TIERS = [
    { lv: "a", d: 1, name: "塾高生レベル ★" },
    { lv: "a", d: 2, name: "塾高生レベル ★★" },
    { lv: "a", d: 3, name: "塾高生レベル ★★★" },
  ];
  const KEYS = ["A", "B", "C", "D"];

  // 標語（0〜20 の数字から）
  const GRADES = [
    { min: 16, g: "A" },
    { min: 11, g: "B" },
    { min: 6, g: "C" },
    { min: 1, g: "D" },
    { min: 0, g: "E" },
  ];


  const pools = TIERS.map(t =>
    QUESTIONS[t.lv].map((q, i) => ({ id: t.lv + i, q })).filter(x => x.q[0] === t.d)
  );

  const $ = id => document.getElementById(id);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };


  let state;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 最近出題した問題を避けて選ぶ。その難度で出せる問題がなければ近い難度から選ぶ
  function pick(tier) {
    const used = new Set(state.log.map(l => l.id));
    for (const t of [tier, tier - 1, tier + 1, tier - 2, tier + 2].filter(t => t >= 0 && t < TIERS.length)) {
      const seen = new Set(store.get("seenA", []));
      let cand = pools[t].filter(x => !used.has(x.id) && !seen.has(x.id));
      if (!cand.length) {
        const ids = new Set(pools[t].map(x => x.id));
        store.set("seenA", [...seen].filter(id => !ids.has(id)));
        cand = pools[t].filter(x => !used.has(x.id));
      }
      if (cand.length) return { item: rnd(cand), tier: t };
    }
    return null;
  }

  // 画面が切り替わったら上端へ（解説へのスムーズスクロール中でも打ち消す）
  function toTop() {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  function show(id) {
    for (const s of ["start", "quiz", "result"]) $(s).hidden = s !== id;
    toTop();
  }

  function start(tier) {
    state = { tier, log: [], cur: null, answered: false };
    show("quiz");
    ask();
  }

  function updateProgress() {
    const done = state.log.length;
    $("meta").textContent = `正解 ${state.log.filter(l => l.ok).length} / ${done}`;
    $("progBar").style.width = `${Math.min(done / BASE, 1) * 100}%`;
  }

  function ask() {
    const got = pick(state.tier);
    if (!got) return finish();
    state.tier = got.tier;
    const item = got.item;
    const [, text, correct, ...rest] = item.q;
    const choices = shuffle([correct, ...rest.slice(0, 3)]);
    state.cur = { ...item, tier: state.tier, choices, correct };
    state.answered = false;

    const n = state.log.length + 1;
    $("qnum").textContent = n <= BASE ? `第${n}問 / ${BASE}` : `第${n}問（延長戦）`;
    $("qlevel").textContent = TIERS[state.tier].name;
    $("qtext").textContent = text;
    updateProgress();

    const box = $("choices");
    box.innerHTML = "";
    choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = `<span class="key">${KEYS[i]}</span><span></span>`;
      b.lastChild.textContent = c;
      b.addEventListener("click", () => answer(i));
      box.appendChild(b);
    });
    $("feedback").hidden = true;
    toTop();
  }

  function answer(i) {
    if (state.answered) return;
    state.answered = true;
    const cur = state.cur;
    const ok = cur.choices[i] === cur.correct;
    [...$("choices").children].forEach((b, j) => {
      b.disabled = true;
      if (cur.choices[j] === cur.correct) b.classList.add("correct");
      else if (j === i) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    state.log.push({ id: cur.id, tier: cur.tier, ok, text: cur.q[1], correct: cur.correct, chosen: cur.choices[i], exp: cur.q[6] });
    store.set("seenA", [...new Set([...store.get("seenA", []), cur.id])]);

    const v = $("verdict");
    v.textContent = ok ? "○ 正解！" : `× 不正解　正解は「${cur.correct}」`;
    v.className = "verdict " + (ok ? "ok" : "ng");
    $("exp").textContent = cur.q[6];

    let msg = "";
    if (ok && state.tier < TIERS.length - 1) {
      state.tier++;
      msg = `レベルアップ！ 次は ${TIERS[state.tier].name}`;
    } else if (ok) {
      msg = "最高レベルをキープ！";
    } else {
      msg = "同じレベルでもう1問挑戦しよう";
    }

    const extra = state.log.length >= BASE;
    $("levelMsg").textContent = msg;
    $("next").textContent = extra ? "解き進める" : "次の問題へ";
    $("finishBtn").hidden = !extra;
    if (state.log.length === BASE) $("levelMsg").textContent = msg + "　｜　10問クリア！続けるか、結果を見るか選べます";
    updateProgress();
    $("feedback").hidden = false;
    $("next").focus({ preventScroll: true });
    $("feedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 正答数と難易度から 0〜20 の評点を出す。満点は「全問正解したときに到達できる難度」の合計
  function evaluate(log) {
    const earned = log.reduce((s, l) => s + (l.ok ? TIERS[l.tier].d : 0), 0);
    const max = log.reduce((s, _, i) => s + Math.min(i + 1, TIERS.length), 0);
    const pt = max ? Math.round((20 * earned) / max) : 0;
    return { earned, max, pt, grade: GRADES.find(g => pt >= g.min) };
  }

  function finish() {
    const log = state.log;
    const n = log.length;
    const ok = log.filter(l => l.ok).length;
    const ev = evaluate(log);

    $("grade").textContent = `${ev.pt}${ev.grade.g}`;
    $("grade").dataset.g = ev.grade.g;
    const rows = [
      ["解答数", `${n}問`],
      ["正答数", `${ok}問（正答率 ${n ? Math.round((ok / n) * 100) : 0}%）`],
      ...TIERS.map((t, i) => {
        const at = log.filter(l => l.tier === i);
        return [`${"★".repeat(t.d)} の問題`, at.length ? `${at.filter(l => l.ok).length} / ${at.length}問 正解` : "―"];
      }),
      ["難易度つき得点", `${ev.earned}点 / ${ev.max}点`],
      ["到達レベル", (() => { const t = Math.max(-1, ...log.filter(l => l.ok).map(l => l.tier)); return t >= 0 ? TIERS[t].name : "―"; })()],
    ];
    $("rbody").innerHTML = "";
    for (const [k, v] of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<th></th><td></td>";
      tr.firstChild.textContent = k;
      tr.lastChild.textContent = v;
      $("rbody").appendChild(tr);
    }
    $("meta").textContent = "";

    const best = store.get("bestA", null);
    if (!best || ev.pt > best.pt) store.set("bestA", { pt: ev.pt, g: ev.grade.g, n });

    const ol = $("review");
    ol.innerHTML = "";
    for (const l of log) {
      const li = document.createElement("li");
      li.innerHTML = `<div><span class="mark"></span><span class="badge"></span></div><div class="q"></div><div class="ans"></div><details><summary>解説</summary><p></p></details>`;
      const mark = li.querySelector(".mark");
      mark.textContent = l.ok ? "○" : "×";
      mark.classList.add(l.ok ? "ok" : "ng");
      li.querySelector(".badge").textContent = TIERS[l.tier].name;
      li.querySelector(".q").textContent = l.text;
      li.querySelector(".ans").textContent = l.ok ? `正解：${l.correct}` : `あなたの解答：${l.chosen} ／ 正解：${l.correct}`;
      li.querySelector("details p").textContent = l.exp;
      ol.appendChild(li);
    }
    show("result");
  }

  function renderStart() {
    $("tierList").innerHTML = "";
    TIERS.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t.name;
      $("tierList").appendChild(li);
    });
    const best = store.get("bestA", null);
    $("best").textContent = best ? `これまでの最高成績：${best.pt}${GRADES.find(g => best.pt >= g.min).g}（${best.n}問）` : "";
    $("meta").textContent = "";
    show("start");
  }

  document.querySelectorAll("[data-start]").forEach(b =>
    b.addEventListener("click", () => start(Number(b.dataset.start)))
  );
  $("next").addEventListener("click", ask);
  $("finishBtn").addEventListener("click", finish);
  $("again").addEventListener("click", renderStart);
  document.addEventListener("keydown", e => {
    if ($("quiz").hidden || e.metaKey || e.ctrlKey) return;
    const k = e.key.toUpperCase();
    const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : KEYS.indexOf(k);
    if (!state.answered && idx >= 0) answer(idx);
  });

  renderStart();
})();
