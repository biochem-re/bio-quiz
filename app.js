(() => {
  const TOTAL = 10;
  const TIERS = [
    { lv: "b", d: 1, name: "初級者レベル ★" },
    { lv: "b", d: 2, name: "初級者レベル ★★" },
    { lv: "b", d: 3, name: "初級者レベル ★★★" },
    { lv: "a", d: 1, name: "塾高生レベル ★" },
    { lv: "a", d: 2, name: "塾高生レベル ★★" },
    { lv: "a", d: 3, name: "塾高生レベル ★★★" },
  ];
  const KEYS = ["A", "B", "C", "D"];

  // 問題をレベル×難度ごとに振り分け（id は "b12" のような形）
  const pools = TIERS.map(t =>
    QUESTIONS[t.lv].map((q, i) => ({ id: t.lv + i, q })).filter(x => x.q[0] === t.d)
  );

  const $ = id => document.getElementById(id);
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

  // 最近出題した問題を避けて選ぶ（その難度の未出題がなくなったら履歴をリセット）
  function pick(tier) {
    const seen = new Set(store.get("seen", []));
    const used = new Set(state.log.map(l => l.id));
    let cand = pools[tier].filter(x => !used.has(x.id) && !seen.has(x.id));
    if (!cand.length) {
      const ids = new Set(pools[tier].map(x => x.id));
      store.set("seen", [...seen].filter(id => !ids.has(id)));
      cand = pools[tier].filter(x => !used.has(x.id));
    }
    return cand[Math.floor(Math.random() * cand.length)];
  }

  function show(id) {
    for (const s of ["start", "quiz", "result"]) $(s).hidden = s !== id;
    window.scrollTo(0, 0);
  }

  function start(tier) {
    state = { tier, log: [], cur: null, answered: false };
    show("quiz");
    ask();
  }

  function ask() {
    const item = pick(state.tier);
    const [, text, correct, ...rest] = item.q;
    const choices = shuffle([correct, ...rest.slice(0, 3)]);
    state.cur = { ...item, tier: state.tier, choices, correct };
    state.answered = false;

    const n = state.log.length + 1;
    $("qnum").textContent = `第${n}問 / ${TOTAL}`;
    $("meta").textContent = `正解 ${state.log.filter(l => l.ok).length} / ${state.log.length}`;
    $("progBar").style.width = `${(state.log.length / TOTAL) * 100}%`;
    const badge = $("qlevel");
    badge.textContent = TIERS[state.tier].name;
    badge.classList.toggle("adv", TIERS[state.tier].lv === "a");
    $("qtext").textContent = text;

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
    store.set("seen", [...new Set([...store.get("seen", []), cur.id])]);

    const v = $("verdict");
    v.textContent = ok ? "○ 正解！" : `× 不正解　正解は「${cur.correct}」`;
    v.className = "verdict " + (ok ? "ok" : "ng");
    $("exp").textContent = cur.q[6];

    const last = state.log.length >= TOTAL;
    let msg = "";
    if (!last) {
      if (ok && state.tier < TIERS.length - 1) {
        state.tier++;
        msg = `レベルアップ！ 次は ${TIERS[state.tier].name}`;
      } else if (ok) {
        msg = "最高レベルをキープ！";
      } else {
        msg = "同じレベルでもう1問挑戦しよう";
      }
    }
    $("levelMsg").textContent = msg;
    $("next").textContent = last ? "結果を見る" : "次の問題へ";
    $("meta").textContent = `正解 ${state.log.filter(l => l.ok).length} / ${state.log.length}`;
    $("progBar").style.width = `${(state.log.length / TOTAL) * 100}%`;
    $("feedback").hidden = false;
    $("next").focus({ preventScroll: true });
    $("feedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function next() {
    if (state.log.length >= TOTAL) finish();
    else ask();
  }

  function finish() {
    const score = state.log.filter(l => l.ok).length;
    const top = Math.max(...state.log.filter(l => l.ok).map(l => l.tier), -1);
    $("score").textContent = score;
    $("reached").textContent = top >= 0 ? `正解した最高レベル：${TIERS[top].name}` : "まずは初級者レベルから挑戦してみよう";
    $("meta").textContent = "";

    const best = store.get("best", null);
    if (!best || score > best.score || (score === best.score && top > best.top)) store.set("best", { score, top });

    const ol = $("review");
    ol.innerHTML = "";
    for (const l of state.log) {
      const li = document.createElement("li");
      li.innerHTML = `<div><span class="mark"></span><span class="badge"></span></div><div class="q"></div><div class="ans"></div><details><summary>解説</summary><p></p></details>`;
      const mark = li.querySelector(".mark");
      mark.textContent = l.ok ? "○" : "×";
      mark.classList.add(l.ok ? "ok" : "ng");
      const bd = li.querySelector(".badge");
      bd.textContent = TIERS[l.tier].name;
      bd.classList.toggle("adv", TIERS[l.tier].lv === "a");
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
    const best = store.get("best", null);
    $("best").textContent = best ? `これまでの最高記録：${best.score}問正解（${best.top >= 0 ? TIERS[best.top].name : "—"}）` : "";
    $("meta").textContent = "";
    show("start");
  }

  document.querySelectorAll("[data-start]").forEach(b =>
    b.addEventListener("click", () => start(Number(b.dataset.start)))
  );
  $("next").addEventListener("click", next);
  $("again").addEventListener("click", renderStart);
  document.addEventListener("keydown", e => {
    if ($("quiz").hidden || e.metaKey || e.ctrlKey) return;
    const k = e.key.toUpperCase();
    const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : KEYS.indexOf(k);
    if (!state.answered && idx >= 0) answer(idx);
  });

  renderStart();
})();
