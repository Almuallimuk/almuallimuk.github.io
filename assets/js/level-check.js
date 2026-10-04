/* =========================================================
   ALMUALLIM — FREE LEVEL CHECK ENGINE (v3)
   - result shows in place (no jump to top)
   - report card asks name + email, sends to Brevo, then downloads PDF
   ========================================================= */
(function () {
  "use strict";

  /* ============ CONFIG ============ */
  const CONFIG = {
    QUESTIONS_PER_STAGE: 5,
    STAGE1_BEGINNER_MAX: 2,
    STAGE1_BORDERLINE: 3,
    STAGE1_ADVANCE_MIN: 4,
    STAGE2_ADVANCED_MIN: 4,
    BREVO_URL: "https://c616f6f2.sibforms.com/serve/MUIFAO4LXPaN1j1KNEvhywbd32fEe81cXMWnr5H-n7rLWzC7eQRAiIWeCyEOjXDtDqFRFwqzjpQ6vQVGbb1mMMPLOy4tOr_A9NKDfFhKfUbx29xQvK9QdFxV6yNOqpXHNZcaJIypYJ5SEO63GkNM4zuQVWZ9feIa3Sko5rRSrsvZ1a9uHfzVXsA57WWfUK-g66NOT1LfifMULHViuA==",
    DATA: {
      quran: "https://cdn.jsdelivr.net/gh/Almuallimuk/almuallimuk.github.io@main/assets/data/questions-quran.json",
      islam: "https://cdn.jsdelivr.net/gh/Almuallimuk/almuallimuk.github.io@main/assets/data/questions-islam.json"
    },
    COURSES: {
      quran: {
        name: "Qur'an Reading & Tajweed",
        levels: {
          beginner:     { label: "Beginner",     startLesson: "Q-01 Arabic Alphabet" },
          intermediate: { label: "Intermediate", startLesson: "Q-11 Ghunna" },
          advanced:     { label: "Advanced",     startLesson: "Q-18 Madd Rules in Detail" }
        }
      },
      islam: {
        name: "Islam: Foundations & Practice",
        levels: {
          beginner:     { label: "Beginner",     startLesson: "Phase 1: Understanding Islam" },
          intermediate: { label: "Intermediate", startLesson: "Phase 4: Sawm — rules" },
          advanced:     { label: "Advanced",     startLesson: "Phase 6: Parents & family" }
        }
      }
    }
  };

  /* ============ STATE ============ */
  const state = {
    course: null,
    stage: 1,
    questions: [],
    qIndex: 0,
    answers: [],
    bank: null,
    stage1Score: 0,
    isTransitioning: false
  };

  /* ============ DOM ============ */
  const el = {
    quizRoot:       document.getElementById("quizRoot"),
    resultRoot:     document.getElementById("resultRoot"),
    resultInner:    document.getElementById("resultInner"),
    progressFill:   document.getElementById("progressFill"),
    qCurrent:       document.getElementById("qCurrent"),
    qTotal:         document.getElementById("qTotal"),
    stageLabel:     document.getElementById("stageLabel"),
    qTopic:         document.getElementById("qTopic"),
    qText:          document.getElementById("qText"),
    qOptions:       document.getElementById("qOptions"),
    qFeedback:      document.getElementById("qFeedback"),
    quizCourseName: document.getElementById("quizCourseName"),
    quizExit:       document.getElementById("quizExit"),
    chooseCourse:   document.getElementById("choose-course")
  };

  /* ============ HELPERS ============ */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickQuestions(pool, n) {
    if (!Array.isArray(pool) || !pool.length) return [];
    const byLesson = {};
    pool.forEach(function (q) {
      if (!byLesson[q.lesson]) byLesson[q.lesson] = [];
      byLesson[q.lesson].push(q);
    });
    const lessons = shuffle(Object.keys(byLesson));
    const picked = [];
    for (let i = 0; i < lessons.length && picked.length < n; i++) {
      const bag = shuffle(byLesson[lessons[i]]);
      picked.push(bag[0]);
    }
    if (picked.length < n) {
      const usedIds = new Set(picked.map(function (p) { return p.id; }));
      const remaining = shuffle(pool.filter(function (q) { return !usedIds.has(q.id); }));
      while (picked.length < n && remaining.length) {
        picked.push(remaining.shift());
      }
    }
    return picked.slice(0, n);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function backToChoose() {
    if (el.chooseCourse) el.chooseCourse.hidden = false;
    if (el.quizRoot) el.quizRoot.hidden = true;
    if (el.resultRoot) el.resultRoot.hidden = true;
    state.course = null;
    state.stage = 1;
    state.questions = [];
    state.qIndex = 0;
    state.answers = [];
    state.bank = null;
    state.stage1Score = 0;
    state.isTransitioning = false;
    if (el.chooseCourse) el.chooseCourse.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showResult() {
    if (el.chooseCourse) el.chooseCourse.hidden = true;
    if (el.quizRoot) el.quizRoot.hidden = true;
    if (el.resultRoot) el.resultRoot.hidden = false;
    // keep the user where the quiz was: scroll to the result block, not the page top
    if (el.resultRoot) {
      window.scrollTo({ top: Math.max(el.resultRoot.offsetTop - 100, 0), behavior: "smooth" });
    }
  }

  /* ============ START COURSE ============ */
  async function startCourse(courseKey) {
    state.course = courseKey;
    state.stage = 1;
    state.answers = [];
    state.qIndex = 0;
    state.stage1Score = 0;
    state.bank = null;
    state.questions = [];
    state.isTransitioning = false;

    if (el.chooseCourse) el.chooseCourse.hidden = true;
    if (el.quizRoot) el.quizRoot.hidden = false;
    if (el.resultRoot) el.resultRoot.hidden = true;
    el.quizCourseName.textContent = CONFIG.COURSES[courseKey].name;

    el.qTopic.textContent = "";
    el.qText.innerHTML = '<span style="color:var(--ink-soft);font-size:.95rem;">Loading questions…</span>';
    el.qOptions.innerHTML = "";
    el.qFeedback.hidden = true;
    el.stageLabel.textContent = "Stage 1";
    el.qCurrent.textContent = "1";
    el.qTotal.textContent = CONFIG.QUESTIONS_PER_STAGE;
    el.progressFill.style.width = "0%";

    window.scrollTo({ top: el.quizRoot.offsetTop - 100, behavior: "smooth" });

    try {
      const res = await fetch(CONFIG.DATA[courseKey]);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Bank is not an array");
      state.bank = data;
      console.log("[LevelCheck] Loaded " + data.length + " questions");
      beginStage(1);
    } catch (err) {
      console.error("[LevelCheck] Load failed:", err);
      el.qText.innerHTML = '<span style="color:#B3261E;">We couldn\'t load the questions. Please check your connection and try again.</span>';
      el.qOptions.innerHTML = '<button type="button" class="btn" onclick="location.reload()">Reload</button>';
    }
  }

  /* ============ BEGIN STAGE ============ */
  function beginStage(stage) {
    state.isTransitioning = false;

    if (!state.bank || !Array.isArray(state.bank)) {
      console.error("[LevelCheck] Bank not available");
      el.qText.textContent = "Something went wrong. Please reload the page.";
      return;
    }

    state.stage = stage;
    state.qIndex = 0;
    state.answers = [];

    const pool = state.bank.filter(function (q) { return q.stage === stage; });
    console.log("[LevelCheck] Stage " + stage + " — " + pool.length + " questions in pool");

    state.questions = pickQuestions(pool, CONFIG.QUESTIONS_PER_STAGE);
    console.log("[LevelCheck] Picked " + state.questions.length + " questions");

    if (!state.questions.length) {
      el.qText.textContent = "No questions found for this stage. Please reload.";
      return;
    }

    el.stageLabel.textContent = "Stage " + stage;
    el.qTotal.textContent = state.questions.length;
    el.qCurrent.textContent = "1";
    el.qFeedback.hidden = true;

    renderQuestion();
  }

  /* ============ RENDER QUESTION ============ */
  function renderQuestion() {
    const q = state.questions[state.qIndex];
    if (!q) {
      console.error("[LevelCheck] No question at index " + state.qIndex);
      return;
    }

    el.qCurrent.textContent = state.qIndex + 1;
    updateProgress();
    el.qTopic.textContent = q.topic || "";
    el.qText.textContent = q.question;

    el.qOptions.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    q.options.forEach(function (opt, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.innerHTML =
        '<span class="opt-letter">' + letters[i] + '</span>' +
        '<span>' + escapeHtml(opt) + '</span>';
      btn.addEventListener("click", function () { selectAnswer(i); });
      el.qOptions.appendChild(btn);
    });

    el.qFeedback.hidden = true;

    const first = el.qOptions.querySelector(".quiz-option");
    if (first) first.focus({ preventScroll: true });
  }

  function updateProgress() {
    const total = state.questions.length;
    const pct = Math.round((state.qIndex / total) * 100);
    el.progressFill.style.width = pct + "%";
  }

  /* ============ SELECT ANSWER ============ */
  function selectAnswer(chosenIdx) {
    const q = state.questions[state.qIndex];
    const isCorrect = chosenIdx === q.answer;

    const allBtns = el.qOptions.querySelectorAll(".quiz-option");
    allBtns.forEach(function (btn, i) {
      btn.disabled = true;
      btn.setAttribute("aria-checked", "false");

      if (i === q.answer) {
        btn.classList.add("correct");
      } else if (i === chosenIdx && !isCorrect) {
        btn.classList.add("wrong");
      }
    });

    // mark the chosen one as selected for a moment
    if (allBtns[chosenIdx]) {
      allBtns[chosenIdx].setAttribute("aria-checked", "true");
    }

    state.answers.push({
      questionId: q.id,
      lesson: q.lesson,
      topic: q.topic,
      chosen: chosenIdx,
      correct: isCorrect
    });

    el.qFeedback.hidden = false;
    el.qFeedback.className = "quiz-feedback " + (isCorrect ? "ok" : "no");
    el.qFeedback.innerHTML =
      "<strong>" + (isCorrect ? "✓ Correct — well done!" : "✗ Correct answer: " + escapeHtml(q.options[q.answer])) + "</strong>" +
      (q.explanation ? "<span>" + escapeHtml(q.explanation) + "</span>" : "");

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn";
    nextBtn.style.marginTop = "18px";
    nextBtn.style.width = "100%";
    const isLast = state.qIndex === state.questions.length - 1;
    nextBtn.textContent = isLast ? "See my level →" : "Next question →";
    nextBtn.addEventListener("click", advance);
    el.qFeedback.appendChild(nextBtn);

    // ====== AUTO SCROLL: feedback + next button ko screen pe le aao ======
    requestAnimationFrame(function(){
      setTimeout(function(){
        const rect = el.qFeedback.getBoundingClientRect();
        const header = document.querySelector('header');
        const headerH = header ? header.offsetHeight : 72;
        const viewportBottom = window.innerHeight - 20;

        // Agar next button viewport ke bahar hai, sirf utna scroll karo jitna zaroori hai
        if (rect.bottom > viewportBottom) {
          const scrollBy = rect.bottom - viewportBottom + 16;
          try {
            window.scrollBy({ top: scrollBy, behavior: "smooth" });
          } catch(e) {
            window.scrollBy(0, scrollBy);
          }
        }
      }, 60);
    });

    nextBtn.focus({ preventScroll: true });
}

  /* ============ ADVANCE ============ */
 function advance() {
    if (state.isTransitioning) return;

    if (state.qIndex < state.questions.length - 1) {
      state.qIndex++;
      renderQuestion();

      // ====== Naya question aane pe card ke top pe scroll karo ======
      requestAnimationFrame(function(){
        setTimeout(function(){
          const card = document.querySelector('.quiz-card');
          if (!card) return;
          const header = document.querySelector('header');
          const headerH = header ? header.offsetHeight : 72;
          const y = card.getBoundingClientRect().top
                  + (window.pageYOffset || document.documentElement.scrollTop)
                  - headerH - 20;
          try { window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" }); }
          catch(e){ window.scrollTo(0, Math.max(y, 0)); }
        }, 50);
      });

      return;
    }

    // Stage complete
    const score = state.answers.filter(function (a) { return a.correct; }).length;
    console.log("[LevelCheck] Stage " + state.stage + " done — score: " + score);

    if (state.stage === 1) {
      state.stage1Score = score;

      if (score >= CONFIG.STAGE1_ADVANCE_MIN) {
        state.isTransitioning = true;
        el.qText.innerHTML = '<span style="color:var(--ink-soft);font-size:.95rem;">Loading Stage 2…</span>';
        el.qOptions.innerHTML = "";
        el.qFeedback.hidden = true;
        el.progressFill.style.width = "0%";
        window.scrollTo({ top: el.quizRoot.offsetTop - 100, behavior: "smooth" });

        setTimeout(function () {
          try {
            beginStage(2);
          } catch (err) {
            console.error("[LevelCheck] Stage 2 error:", err);
            el.qText.textContent = "Could not load Stage 2. Please reload.";
            el.qOptions.innerHTML = '<button type="button" class="btn" onclick="location.reload()">Reload</button>';
          }
        }, 400);
      } else {
        const level = (score <= CONFIG.STAGE1_BEGINNER_MAX) ? "beginner" : "intermediate";
        renderResult(level, score, state.questions.length, null);
      }
    } else {
      // Stage 2 done
      const level = (score >= CONFIG.STAGE2_ADVANCED_MIN) ? "advanced" : "intermediate";
      renderResult(level, score, state.questions.length, state.stage1Score);
    }
  }

  /* ============ REPORT CARD: ASK EMAIL → BREVO → PDF ============ */
  function openReportModal(info) {
    if (document.getElementById("rcModal")) return;

    if (!document.getElementById("rcModalStyle")) {
      const st = document.createElement("style");
      st.id = "rcModalStyle";
      st.textContent =
        ".rc-overlay{position:fixed;inset:0;background:rgba(10,42,31,.6);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px}" +
        ".rc-box{background:#fff;border-radius:14px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.3);max-height:90vh;overflow:auto}" +
        ".rc-box h3{margin:0 0 6px;font-size:1.25rem;color:#0A2A1F}" +
        ".rc-box p{margin:0 0 14px;color:#4b5b54;font-size:.95rem}" +
        ".rc-l{display:block;font-weight:600;font-size:.9rem;margin:10px 0 4px}" +
        ".rc-box input[type=text],.rc-box input[type=email]{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #c9c2ad;border-radius:8px;font-size:1rem}" +
        ".rc-consent{display:flex;gap:8px;align-items:flex-start;font-size:.85rem;margin:14px 0;color:#4b5b54}" +
        ".rc-consent input{margin-top:3px}" +
        ".rc-err{color:#B3261E;font-size:.9rem;min-height:1.2em;margin:6px 0}" +
        ".rc-actions{display:flex;gap:10px;flex-wrap:wrap}";
      document.head.appendChild(st);
    }

    const wrap = document.createElement("div");
    wrap.id = "rcModal";
    wrap.className = "rc-overlay";
    wrap.innerHTML =
      '<div class="rc-box" role="dialog" aria-modal="true" aria-labelledby="rcTitle">' +
        '<h3 id="rcTitle">Get your report card</h3>' +
        '<p>Enter your details and your personalised PDF will download straight away.</p>' +
        '<label class="rc-l" for="rcName">First name</label>' +
        '<input type="text" id="rcName" maxlength="60" autocomplete="given-name">' +
        '<label class="rc-l" for="rcEmail">Email address</label>' +
        '<input type="email" id="rcEmail" maxlength="120" autocomplete="email">' +
        '<label class="rc-consent" for="rcConsent">' +
          '<input type="checkbox" id="rcConsent">' +
          '<span>I agree to receive my results and occasional Qur\'an learning tips from Almuallim by email. I can unsubscribe at any time. See our <a href="/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>.</span>' +
        '</label>' +
        '<div class="rc-err" id="rcError" role="alert"></div>' +
        '<div class="rc-actions">' +
          '<button type="button" class="btn" id="rcSubmit">Download my report card</button>' +
          '<button type="button" class="btn btn-outline" id="rcCancel">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    const nameIn = document.getElementById("rcName");
    const emailIn = document.getElementById("rcEmail");
    const consentIn = document.getElementById("rcConsent");
    const errBox = document.getElementById("rcError");
    const submitBtn = document.getElementById("rcSubmit");
    nameIn.focus();

    function closeModal() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.getElementById("rcCancel").addEventListener("click", closeModal);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) closeModal(); });

    submitBtn.addEventListener("click", async function () {
      const name = nameIn.value.trim();
      const email = emailIn.value.trim();
      errBox.textContent = "";

      if (!name) { errBox.textContent = "Please enter your first name."; nameIn.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errBox.textContent = "Please enter a valid email address."; emailIn.focus(); return; }
      if (!consentIn.checked) { errBox.textContent = "Please tick the box to continue."; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = "Preparing your PDF…";

      // 1) Send to Brevo (the PDF is still given if this fails)
      try {
        const body = new URLSearchParams();
        body.append("FIRSTNAME", name);
        body.append("EMAIL", email);
        body.append("COURSE", info.courseName);
        body.append("LEVEL", info.levelLabel);
        body.append("WEAK_AREAS", info.weak.length ? info.weak.join(", ").slice(0, 200) : "None");
        body.append("email_address_check", "");
        body.append("locale", "en");
        await fetch(CONFIG.BREVO_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
        });
      } catch (err) {
        console.warn("[LevelCheck] Brevo send failed:", err);
      }

      // 2) Make the PDF
      try {
        await window.downloadReportCard({
          course: info.courseKey,
          name: name,
          level: info.levelLabel + " level",
          score: info.score,
          total: info.total,
          recommendedLesson: info.startLesson,
          weakAreas: info.weak.slice(0, 3)
        });
        closeModal();
      } catch (err) {
        console.error("[LevelCheck] PDF error:", err);
        errBox.textContent = "Sorry, we could not create the PDF. Please try again.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Download my report card";
      }
    });
  }

  /* ============ RENDER RESULT ============ */
  function renderResult(level, score, total, stage1Score) {
    const course = CONFIG.COURSES[state.course];
    const levelMeta = course.levels[level];

    const wrongTopics = [];
    const rightTopics = [];
    state.answers.forEach(function (a) {
      const tag = a.lesson + " " + a.topic;
      if (a.correct) rightTopics.push(tag);
      else wrongTopics.push(tag);
    });
    const weak = Array.from(new Set(wrongTopics));
    const strong = Array.from(new Set(rightTopics)).filter(function (t) { return weak.indexOf(t) === -1; });

    const scoreLine = stage1Score !== null
      ? "Stage 1: " + stage1Score + "/5 · Stage 2: " + score + "/" + total
      : "Score: " + score + "/" + total;

    let html = "";
    html += '<div class="result-hero">';
    html +=   '<span class="eyebrow">Your result</span>';
    html +=   '<div class="result-level-badge">';
    html +=     '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.9H22l-6 4.5 2.3 7.1L12 16.4 5.7 20.5 8 13.4 2 8.9h7.4z"/></svg>';
    html +=     escapeHtml(levelMeta.label) + " level";
    html +=   '</div>';
    html +=   '<h1>You\'re ready to start at <span style="color:var(--gold)">' + escapeHtml(levelMeta.startLesson) + '</span></h1>';
    html +=   '<div class="result-score">' + scoreLine + '</div>';
    html += '</div>';

    html += '<div class="result-grid">';

    html +=   '<div class="result-card" style="border-left:3px solid var(--green-light)">';
    html +=     '<h3>Start here</h3>';
    html +=     '<p><strong>' + escapeHtml(levelMeta.startLesson) + '</strong></p>';
    html +=     '<p>This is the lesson that matches your current level. Your teacher will begin here and adjust as you progress.</p>';
    html +=   '</div>';

    if (weak.length) {
      html +=   '<div class="result-card" style="border-left:3px solid #C77A5C">';
      html +=     '<h3>Revise before you start</h3>';
      html +=     '<ul class="result-weak-list">';
      weak.forEach(function (t) { html += '<li>' + escapeHtml(t) + '</li>'; });
      html +=     '</ul>';
      html +=   '</div>';
    }

    if (strong.length) {
      html +=   '<div class="result-card" style="border-left:3px solid var(--green-light)">';
      html +=     '<h3>You already know</h3>';
      html +=     '<ul class="result-strong-list">';
      strong.forEach(function (t) { html += '<li>' + escapeHtml(t) + '</li>'; });
      html +=     '</ul>';
      html +=   '</div>';
    }

    const otherCourse = state.course === "quran" ? "islam" : "quran";
    const otherName = CONFIG.COURSES[otherCourse].name;
    html +=   '<div class="result-card" style="border-left:3px solid var(--gold)">';
    html +=     '<h3>Take the second check too</h3>';
    html +=     '<p>You\'ve checked <strong>' + escapeHtml(course.name) + '</strong>. Now try <strong>' + escapeHtml(otherName) + '</strong> — another 5 minutes.</p>';
    html +=     '<button type="button" class="btn btn-outline" style="margin-top:14px" id="takeOther">Check ' + escapeHtml(otherName) + ' →</button>';
    html +=   '</div>';

    html += '</div>';

    html += '<div class="result-actions">';
    html +=   '<button type="button" class="btn" id="getReport">Get my report card →</button>';
    html +=   '<button type="button" class="btn btn-outline" id="retakeTest">Retake this check</button>';
    html += '</div>';

    el.resultInner.innerHTML = html;

    const takeOther = document.getElementById("takeOther");
    if (takeOther) takeOther.addEventListener("click", function () { startCourse(otherCourse); });

    const retake = document.getElementById("retakeTest");
    if (retake) retake.addEventListener("click", function () { startCourse(state.course); });

    // Everything the report card needs, captured now
    const reportInfo = {
      courseKey: state.course,
      courseName: course.name,
      levelLabel: levelMeta.label,
      startLesson: levelMeta.startLesson,
      weak: weak,
      score: (stage1Score !== null ? stage1Score : 0) + score,
      total: (stage1Score !== null ? 5 : 0) + total
    };

    const getReport = document.getElementById("getReport");
    if (getReport) getReport.addEventListener("click", function () {
      if (typeof window.downloadReportCard !== "function") {
        alert("PDF tool did not load. Please refresh the page and try again.");
        return;
      }
      openReportModal(reportInfo);
    });

    showResult();
  }

  /* ============ WIRE UP ============ */
  document.querySelectorAll("[data-course]").forEach(function (card) {
    card.addEventListener("click", function (e) {
      e.preventDefault();
      const course = card.getAttribute("data-course");
      if (course) startCourse(course);
    });
  });

  if (el.quizExit) el.quizExit.addEventListener("click", backToChoose);

})();
