/* =========================================================
   ALMUALLIM — FREE LEVEL CHECK ENGINE
   Vanilla JS, no build step. Fetches question banks from JSON.
   ========================================================= */
(function () {
  "use strict";

  /* ============ CONFIG (edit thresholds here) ============ */
  const CONFIG = {
    QUESTIONS_PER_STAGE: 5,

    // Stage 1 scoring
    STAGE1_BEGINNER_MAX: 2,        // 0-2  → Beginner (stop)
    STAGE1_BORDERLINE: 3,          // 3    → Intermediate (stop, revise)
    STAGE1_ADVANCE_MIN: 4,         // 4-5  → continue to Stage 2

    // Stage 2 scoring
    STAGE2_ADVANCED_MIN: 4,        // 4-5  → Advanced
                                   // 0-3  → Intermediate

    // Data paths
    DATA: {
      quran: "/assets/data/questions-quran.json",
      islam: "/assets/data/questions-islam.json"
    },

    // Course meta (display names + recommended start lessons)
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
    course: null,          // 'quran' | 'islam'
    stage: 1,              // 1 or 2
    questions: [],         // current stage questions
    qIndex: 0,             // 0-based
    answers: [],           // {question, chosen, correct}
    bank: null,            // full bank for course
    stage1Score: 0
  };

  /* ============ DOM CACHE ============ */
  const el = {
    quizRoot:   document.getElementById("quizRoot"),
    resultRoot: document.getElementById("resultRoot"),
    resultInner:document.getElementById("resultInner"),
    progressFill: document.getElementById("progressFill"),
    qCurrent:   document.getElementById("qCurrent"),
    qTotal:     document.getElementById("qTotal"),
    stageLabel: document.getElementById("stageLabel"),
    qTopic:     document.getElementById("qTopic"),
    qText:      document.getElementById("qText"),
    qOptions:   document.getElementById("qOptions"),
    qFeedback:  document.getElementById("qFeedback"),
    quizCourseName: document.getElementById("quizCourseName"),
    quizExit:   document.getElementById("quizExit"),
    chooseCourse: document.getElementById("choose-course")
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

  // Pick N questions ensuring at most 1 per lesson (if possible)
  function pickQuestions(pool, n) {
    const byLesson = {};
    pool.forEach(q => {
      if (!byLesson[q.lesson]) byLesson[q.lesson] = [];
      byLesson[q.lesson].push(q);
    });
    const lessons = shuffle(Object.keys(byLesson));
    const picked = [];
    for (const lesson of lessons) {
      if (picked.length >= n) break;
      const bag = shuffle(byLesson[lesson]);
      picked.push(bag[0]);
    }
    // If still short (not enough lessons), fill randomly with unused Qs
    if (picked.length < n) {
      const usedIds = new Set(picked.map(p => p.id));
      const remaining = shuffle(pool.filter(q => !usedIds.has(q.id)));
      while (picked.length < n && remaining.length) {
        picked.push(remaining.shift());
      }
    }
    return picked.slice(0, n);
  }

  function showQuiz() {
    if (el.chooseCourse) el.chooseCourse.hidden = true;
    if (el.quizRoot)  el.quizRoot.hidden = false;
    if (el.resultRoot) el.resultRoot.hidden = true;
  }

  function showResult() {
    if (el.chooseCourse) el.chooseCourse.hidden = true;
    if (el.quizRoot)   el.quizRoot.hidden = true;
    if (el.resultRoot) el.resultRoot.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToChoose() {
    if (el.chooseCourse) el.chooseCourse.hidden = false;
    if (el.quizRoot)   el.quizRoot.hidden = true;
    if (el.resultRoot) el.resultRoot.hidden = true;
    state.course = null; state.stage = 1; state.questions = [];
    state.qIndex = 0; state.answers = []; state.bank = null; state.stage1Score = 0;
    const choose = document.getElementById("choose-course");
    if (choose) choose.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============ QUIZ FLOW ============ */

  async function startCourse(courseKey) {
    state.course = courseKey;
    state.stage = 1;
    state.answers = [];
    state.qIndex = 0;
    state.stage1Score = 0;

    // Show loading
    if (el.chooseCourse) el.chooseCourse.hidden = true;
    if (el.quizRoot) el.quizRoot.hidden = false;
    if (el.resultRoot) el.resultRoot.hidden = true;
    el.quizCourseName.textContent = CONFIG.COURSES[courseKey].name;
    el.qOptions.innerHTML = "";
    el.qFeedback.hidden = true;
    el.qText.textContent = "";
    el.qTopic.textContent = "";
    el.quizRoot.querySelector(".quiz-card").innerHTML =
      '<div class="quiz-loading"><div class="spinner"></div>Loading questions…</div>';
    window.scrollTo({ top: el.quizRoot.offsetTop - 100, behavior: "smooth" });

    // Fetch bank
    try {
      if (!state.bank) {
        const res = await fetch(CONFIG.DATA[courseKey], { cache: "force-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        state.bank = await res.json();
      }
      // Restore quiz card DOM (in case we replaced it with loading)
      restoreQuizCardDOM();
      beginStage(1);
    } catch (err) {
      console.error("Failed to load questions:", err);
      el.quizRoot.querySelector(".wrap").innerHTML =
        '<div class="quiz-error"><h3>We couldn\'t load the questions</h3>' +
        '<p>Please check your connection and try again.</p>' +
        '<button type="button" class="btn" onclick="location.reload()">Reload</button></div>';
    }
  }

  function restoreQuizCardDOM() {
    // Rebuild quiz card if it was replaced with loading
    const existingCard = el.quizRoot.querySelector(".quiz-card");
    if (existingCard) return; // still there
    const wrap = el.quizRoot.querySelector(".wrap");
    wrap.insertAdjacentHTML("beforeend",
      '<div class="quiz-card">' +
        '<div class="quiz-topic" id="qTopic">Topic</div>' +
        '<h2 class="quiz-question" id="qText"></h2>' +
        '<div class="quiz-options" id="qOptions" role="radiogroup"></div>' +
        '<div class="quiz-feedback" id="qFeedback" hidden></div>' +
      '</div>'
    );
    el.qTopic    = document.getElementById("qTopic");
    el.qText     = document.getElementById("qText");
    el.qOptions  = document.getElementById("qOptions");
    el.qFeedback = document.getElementById("qFeedback");
  }

  function beginStage(stage) {
    state.stage = stage;
    state.qIndex = 0;
    state.answers = [];

    const pool = state.bank.filter(q => q.stage === stage);
    if (pool.length < CONFIG.QUESTIONS_PER_STAGE) {
      console.warn("Not enough questions in bank for stage " + stage);
    }
    state.questions = pickQuestions(pool, CONFIG.QUESTIONS_PER_STAGE);

    el.stageLabel.textContent = "Stage " + stage;
    el.qTotal.textContent = state.questions.length;
    el.qFeedback.hidden = true;
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.qIndex];
    if (!q) return;

    el.qCurrent.textContent = state.qIndex + 1;
    updateProgress();
    el.qTopic.textContent = q.topic || "";
    el.qText.textContent  = q.question;

    el.qOptions.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.innerHTML =
        '<span class="opt-letter">' + letters[i] + '</span>' +
        '<span>' + escapeHtml(opt) + '</span>';
      btn.addEventListener("click", () => selectAnswer(i));
      el.qOptions.appendChild(btn);
    });

    el.qFeedback.hidden = true;

    // Focus first option for keyboard users
    const first = el.qOptions.querySelector(".quiz-option");
    if (first) first.focus({ preventScroll: true });
  }

  function updateProgress() {
    const total = state.questions.length;
    const current = state.qIndex + 1;
    // Progress = (answered + current in-progress) / total
    const pct = Math.round(((state.qIndex) / total) * 100);
    el.progressFill.style.width = pct + "%";
  }

  function selectAnswer(chosenIdx) {
    const q = state.questions[state.qIndex];
    const isCorrect = chosenIdx === q.answer;

    // Disable all options, mark right/wrong
    const allBtns = el.qOptions.querySelectorAll(".quiz-option");
    allBtns.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) {
        btn.style.borderColor = "var(--green-light)";
        btn.style.background = "rgba(46,125,84,.1)";
      } else if (i === chosenIdx && !isCorrect) {
        btn.style.borderColor = "#C77A5C";
        btn.style.background = "rgba(199,90,60,.08)";
      }
    });

    state.answers.push({
      questionId: q.id,
      lesson: q.lesson,
      topic: q.topic,
      chosen: chosenIdx,
      correct: isCorrect
    });

    // Feedback
    el.qFeedback.hidden = false;
    el.qFeedback.className = "quiz-feedback " + (isCorrect ? "ok" : "no");
    el.qFeedback.innerHTML =
      "<strong>" + (isCorrect ? "✓ Correct" : "✗ " + "Correct answer: " + q.options[q.answer]) + "</strong>" +
      (q.explanation ? "<span>" + escapeHtml(q.explanation) + "</span>" : "");

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "btn";
    nextBtn.style.marginTop = "18px";
    nextBtn.style.width = "100%";
    const isLast = state.qIndex === state.questions.length - 1;
    nextBtn.textContent = isLast ? "See my level →" : "Next question →";
    nextBtn.addEventListener("click", advance);
    el.qFeedback.appendChild(nextBtn);
    nextBtn.focus({ preventScroll: true });
  }

  function advance() {
    if (state.qIndex < state.questions.length - 1) {
      state.qIndex++;
      renderQuestion();
    } else {
      // Stage complete
      const score = state.answers.filter(a => a.correct).length;

      if (state.stage === 1) {
        state.stage1Score = score;

        if (score >= CONFIG.STAGE1_ADVANCE_MIN) {
          // Continue to Stage 2
          beginStage(2);
          window.scrollTo({ top: el.quizRoot.offsetTop - 100, behavior: "smooth" });
        } else {
          // Stop at stage 1 → level determined
          showResultForStage1(score);
        }
      } else {
        // Stage 2 complete → final result
        showResultFinal(score);
      }
    }
  }

  /* ============ RESULT CALCULATION ============ */

  function calculateLevel(stage1Score, stage2Score) {
    // Stage 2 not taken
    if (stage2Score === null) {
      if (stage1Score <= CONFIG.STAGE1_BEGINNER_MAX) return "beginner";
      if (stage1Score === CONFIG.STAGE1_BORDERLINE) return "intermediate";
      // (shouldn't reach here — if 4-5 stage1, we'd go to stage2)
      return "intermediate";
    }
    // Stage 2 taken
    if (stage2Score >= CONFIG.STAGE2_ADVANCED_MIN) return "advanced";
    return "intermediate";
  }

  function showResultForStage1(score) {
    const level = calculateLevel(score, null);
    renderResult(level, score, state.questions.length, null);
  }

  function showResultFinal(stage2Score) {
    const level = calculateLevel(state.stage1Score, stage2Score);
    // Combined score display
    const totalQ = state.questions.length; // stage 2 count
    renderResult(level, stage2Score, totalQ, state.stage1Score);
  }

  /* ============ RESULT RENDER ============ */

  function renderResult(level, score, total, stage1Score) {
    const course = CONFIG.COURSES[state.course];
    const levelMeta = course.levels[level];

    // Collect weak + strong topics from ALL answers across stages
    const wrongTopics = state.answers
      .filter(a => !a.correct)
      .map(a => a.lesson + " " + a.topic);
    const rightTopics = state.answers
      .filter(a => a.correct)
      .map(a => a.lesson + " " + a.topic);

    // Deduplicate
    const weak   = [...new Set(wrongTopics)];
    const strong = [...new Set(rightTopics)].filter(t => !weak.includes(t));

    // Build HTML
    const scoreLine = stage1Score !== null
      ? "Stage 1: " + stage1Score + "/5 · Stage 2: " + score + "/" + total
      : "Score: " + score + "/" + total;

    let html = "";

    html += '<div class="result-hero">';
    html +=   '<span class="eyebrow">Your result</span>';
    html +=   '<div class="result-level-badge">';
    html +=     '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.9H22l-6 4.5 2.3 7.1L12 16.4 5.7 20.5 8 13.4 2 8.9h7.4z"/></svg>';
    html +=     levelMeta.label + " level";
    html +=   '</div>';
    html +=   '<h1>You\'re ready to start at <span style="color:var(--gold)">' + escapeHtml(levelMeta.startLesson) + '</span></h1>';
    html +=   '<div class="result-score">' + scoreLine + '</div>';
    html += '</div>';

    html += '<div class="result-grid">';

    // Start here card
    html +=   '<div class="result-card" style="border-left:3px solid var(--green-light)">';
    html +=     '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>Start here</h3>';
    html +=     '<p><strong>' + escapeHtml(levelMeta.startLesson) + '</strong></p>';
    html +=     '<p>This is the lesson that matches your current level. Your teacher will begin here and adjust as you progress.</p>';
    html +=   '</div>';

    // Weak topics card
    if (weak.length) {
      html +=   '<div class="result-card" style="border-left:3px solid #C77A5C">';
      html +=     '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>Revise before you start</h3>';
      html +=     '<ul class="result-weak-list">';
      weak.forEach(t => { html += '<li>' + escapeHtml(t) + '</li>'; });
      html +=     '</ul>';
      html +=   '</div>';
    }

    // Strong topics card
    if (strong.length) {
      html +=   '<div class="result-card" style="border-left:3px solid var(--green-light)">';
      html +=     '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>You already know</h3>';
      html +=     '<ul class="result-strong-list">';
      strong.forEach(t => { html += '<li>' + escapeHtml(t) + '</li>'; });
      html +=     '</ul>';
      html +=   '</div>';
    }

    // Second course suggestion
    const otherCourse = state.course === "quran" ? "islam" : "quran";
    const otherName = CONFIG.COURSES[otherCourse].name;
    html +=   '<div class="result-card" style="border-left:3px solid var(--gold)">';
    html +=     '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Take the second check too</h3>';
    html +=     '<p>You\'ve checked <strong>' + escapeHtml(course.name) + '</strong>. Now try <strong>' + escapeHtml(otherName) + '</strong> — another 5 minutes.</p>';
    html +=     '<button type="button" class="btn btn-outline" style="margin-top:14px" id="takeOther">Check ' + escapeHtml(otherName) + ' →</button>';
    html +=   '</div>';

    html += '</div>'; // result-grid

    // CTA (form will come in Step 5)
    html += '<div class="result-actions">';
    html +=   '<button type="button" class="btn" id="getReport">Get my report card →</button>';
    html +=   '<button type="button" class="btn btn-outline" id="retakeTest">Retake this check</button>';
    html += '</div>';

    el.resultInner.innerHTML = html;

    // Wire actions
    const takeOther = document.getElementById("takeOther");
    if (takeOther) takeOther.addEventListener("click", () => startCourse(otherCourse));

    const retake = document.getElementById("retakeTest");
    if (retake) retake.addEventListener("click", () => startCourse(state.course));

    const getReport = document.getElementById("getReport");
    if (getReport) getReport.addEventListener("click", () => {
      // Step 5 will hook here. For now, scroll to contact placeholder or alert.
      alert("Report card form coming in the next step!");
      // TODO: open report form modal in Step 5
    });

    showResult();
  }

  /* ============ UTILITIES ============ */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ============ WIRE COURSE CARDS ============ */

  document.querySelectorAll("[data-course]").forEach(card => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      const course = card.getAttribute("data-course");
      if (course) startCourse(course);
    });
  });

  // Exit button
  if (el.quizExit) {
    el.quizExit.addEventListener("click", backToChoose);
  }

})();
