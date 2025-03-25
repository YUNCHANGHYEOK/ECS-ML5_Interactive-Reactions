// ==== 상태 관리 ====
let allDrawings = [];           // 저장된 모든 그림 선분 배열
let currentPoints = [];         // 현재 그리고 있는 선의 좌표들

let isWritingMode = false;      // 쓰기 모드 여부
let isEraseMode = false;        // 지우기 모드 여부
let wasOKGesture = false;       // OK 제스처가 이전 프레임에서 감지됐는지
let isFirstPoint = true;        // 선 그리기의 첫 점인지 여부

let lastToggleTime = 0;         // 마지막 모드 토글 시간
let toggleDelay = 500;          // 모드 변경 딜레이(ms)


// ==== 컬러 ====
let currentStrokeColor;         // 현재 선 색상
let showColorPicker = false;    // 색상 선택창 표시 여부
let selectedHSVColor = null;    // HSV 휠에서 선택된 색상
let selectedHSVPosition = null; // HSV에서 선택된 좌표 위치


// ==== 효과 ====
let currentEffect = "";         // 현재 적용된 효과 ("GOOD", "FIREWORK" 등)
let effectTimer = 0;            // 효과 시작 시간
let displayDuration = 2000;     // 효과 표시 시간(ms)


// ==== 손 추적 ====
let video;                      // 비디오 객체
let handPose;                   // ml5 handPose 모델
let hands = [];                 // 감지된 손 정보


// ==== HSV 휠 ====
let hsvRadius = 100;            // 컬러 휠 반지름
let colorPickerTop = 110;       // 컬러 피커 상단 위치
let hsvCenterX, hsvCenterY;     // 컬러 휠 중심 좌표
let hsvWheelImage;              // 컬러 휠 이미지 (미리 렌더링)


// ==== UI 위치/크기 ====
const buttonX = 20, buttonY = 20, buttonW = 100, buttonH = 50;
const writeButtonW = 100, writeButtonH = 50;
const eraseModeButtonW = 150, eraseModeButtonH = 50;

// 그리기용 좌표 보정 변수
let smoothX = 0;
let smoothY = 0;


//컬러 고정 안내 메시지지
let showLockMessage = false;
let lockMessageTimer = 0;



function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);                       // 캔버스 생성
  video = createCapture(VIDEO, { flipped: true }); // 비디오 캡처 시작
  video.hide();                                 // 비디오 DOM 숨기기
  handPose.detectStart(video, gotHands);        // 손 인식 시작

  currentStrokeColor = color(0, 0, 255);         // 기본 색: 파랑

  hsvCenterX = width / 2;                        // HSV 휠 중심
  hsvCenterY = colorPickerTop + 120;

  // 컬러휠 이미지 생성
  hsvWheelImage = createGraphics(hsvRadius * 2, hsvRadius * 2);
  hsvWheelImage.colorMode(HSB);

  // 휠에 색상 픽셀 그리기
  for (let angle = 0; angle < 360; angle++) {
    for (let r = 0; r < hsvRadius; r++) {
      let hue = angle;
      let saturation = r / hsvRadius;
      let x = hsvRadius + cos(radians(angle)) * r;
      let y = hsvRadius + sin(radians(angle)) * r;
      let c = hsvWheelImage.color(hue, saturation * 100, 100);
      hsvWheelImage.stroke(c);
      hsvWheelImage.point(x, y);
    }
  }

  hsvWheelImage.colorMode(RGB); // 색상 모드 원래대로
}




function gotHands(results) {
  hands = results;
}


// HSV 휠에서 좌표에 해당하는 색상 가져오기
function getHSVColorFromPosition(x, y) {
  let dx = x - hsvCenterX;
  let dy = y - hsvCenterY;
  let distance = sqrt(dx * dx + dy * dy);

  if (distance > hsvRadius) return null;

  let angle = degrees(atan2(dy, dx));
  if (angle < 0) angle += 360;

  let hue = angle;
  let saturation = distance / hsvRadius;
  let brightness = 1;

  colorMode(HSB);
  let col = color(hue, saturation * 100, brightness * 100);
  colorMode(RGB);
  return col;
}

function draw() {
  // 1. 배경 카메라
  image(video, 0, 0);

  // 2. 선 그리기
  drawSavedLines();
  drawCurrentLine();

  // 3. 손 인식 처리
  handleHands();

  // 4. UI 버튼
  drawEraseButton();
  drawWriteButton();
  drawEraseModeButton();
  drawRightButtons();

  // 5. 컬러 선택창
  if (showColorPicker) drawColorPicker();

  // 6. 상태 텍스트
  drawStatusText();

  // 7. 효과 텍스트
  drawEffects();
}

// 저장된 모든 그림 데이터를 순회하며 선을 화면에 그린다.
// 각 선은 저장 당시의 색상으로 다시 렌더링됨.
function drawSavedLines() {
  for (let drawing of allDrawings) {
    stroke(drawing.col);         // 저장된 색상
    strokeWeight(4);             // 선 두께
    noFill();
    drawSmoothLine(drawing.points); // 점들을 부드럽게 연결해 선 그리기
  }
}


// 현재 그리고 있는 선을 화면에 그린다.
// 저장되기 전까지 실시간으로 사용자가 그리는 선을 보여줌.
function drawCurrentLine() {
  stroke(currentStrokeColor);    // 현재 선택된 선 색상
  strokeWeight(4);
  noFill();
  drawSmoothLine(currentPoints); // 아직 저장되지 않은 점들을 연결
  noStroke();
}



// 손 추적 결과를 바탕으로 동작을 제어함.
// 손이 1개일 때는 버튼 클릭, 그리기, 색상 선택이 가능하고
// 손이 2개 이상일 때는 현재 선을 저장하고 초기화함.
function handleHands() {
  if (hands.length === 1) {
    let hand = hands[0];
    let index = hand.index_finger_tip;

    if (showColorPicker) {
      // 색상 선택 모드일 경우, HSV 휠에서 색을 고름
      let col = getHSVColorFromPosition(index.x, index.y);
      if (col !== null) {
        selectedHSVColor = col;
        selectedHSVPosition = { x: index.x, y: index.y };
      }

      // 확인 버튼을 누르면 색상 적용
      if (index.x > width / 2 + 80 && index.x < width / 2 + 140 &&
          index.y > hsvCenterY + hsvRadius + 30 &&
          index.y < hsvCenterY + hsvRadius + 60 &&
          selectedHSVColor !== null) {
          currentStrokeColor = selectedHSVColor;
          selectedHSVColor = null;
          selectedHSVPosition = null;
          showColorPicker = false;
      }
    } else {
      // 일반 모드일 때는 버튼 처리 및 그리기
      handleButtons(index);
      handleDrawing(hand, index);
    }
  } else if (hands.length >= 2) {
    // 양손 인식되면 그리기를 마무리하고 초기화
    if (currentPoints.length > 0) {
      allDrawings.push({ points: [...currentPoints], col: currentStrokeColor });
      currentPoints = [];
      isFirstPoint = true;
    }
    wasOKGesture = false;
  }
}


// HSV 컬러 휠과 색상 확인 버튼을 포함한 색상 선택 UI를 그린다.
// 선택된 색상을 원형 휠에서 시각적으로 표시해줌.
function drawColorPicker() {
  fill(50, 50, 50, 200);
  noStroke();
  rect(width / 2 - 160, colorPickerTop, 320, 280, 10); // 배경 패널

  setTextStyle();
  textSize(16);
  text("HSV Color Picker", width / 2, colorPickerTop + 10); // 제목

  image(hsvWheelImage, hsvCenterX - hsvRadius, hsvCenterY - hsvRadius); // 컬러 휠

  // 선택된 색상 미리보기 박스
  fill(selectedHSVColor || 255);
  stroke(0);
  rect(width / 2 - 40, hsvCenterY + hsvRadius + 20, 60, 30, 5);

  // 확인 버튼
  fill(0, 200, 0);
  stroke(0);
  rect(width / 2 + 80, hsvCenterY + hsvRadius + 20, 60, 30, 5);
  text("확인", width / 2 + 110, hsvCenterY + hsvRadius + 35);

  // 손가락 위치 표시 (휠 안일 때만)
  if (hands.length >= 1) {
    let hand = hands[0];
    let index = hand.index_finger_tip;
    let dx = index.x - hsvCenterX;
    let dy = index.y - hsvCenterY;
    let distFromCenter = sqrt(dx * dx + dy * dy);
    if (distFromCenter <= hsvRadius) {
      stroke(0);
      strokeWeight(2);
      fill(255, 255, 255, 180);
      ellipse(index.x, index.y, 15, 15);
    }

    // 선택된 위치 표시용 원
    if (selectedHSVPosition) {
      stroke(255);
      strokeWeight(2);
      noFill();
      ellipse(selectedHSVPosition.x, selectedHSVPosition.y, 20);
    }
  }

  // 안내 문구
  text("✋ 양손을 올리면 색이 고정됩니다", width / 2, hsvCenterY + hsvRadius + 5);

  // 색상 고정 메시지 (양손 인식 시)
  if (hands.length >= 2 && selectedHSVColor && selectedHSVPosition) {
    showLockMessage = true;
    lockMessageTimer = millis();
    text("✔ 색상이 고정되었습니다", width / 2, colorPickerTop + 260);
  }
}

// 상단 중앙에 현재 모드(Writing/Erasing)와 현재 색상 정보를 표시함
function drawStatusText() {
  setTextStyle();                            // 텍스트 스타일 설정 (중앙정렬, 흰색, 검정 테두리)
  textSize(24);                              // 모드 상태 텍스트 크기 설정

  if (isEraseMode) {
    text("Erase Mode ON", width / 2, 30);    // 지우기 모드 활성 상태 표시
  } else {
    text(isWritingMode ? "Writing Mode ON"   // 쓰기 모드 활성/비활성 상태 표시
                       : "Writing Mode OFF", width / 2, 30);
  }

  fill(currentStrokeColor);                  // 현재 선택된 색으로 사각형 채우기
  stroke(0);                                 // 사각형 테두리: 검정
  strokeWeight(2);
  rect(width / 2 - 15, 50, 30, 20, 5);        // 현재 색상 미리보기 사각형

  setTextStyle();                            // 텍스트 스타일 다시 설정
  textSize(16);
  text("현재 색깔 : ", width / 2 - 60, 60);  // 사각형 왼쪽에 텍스트 표시
}


// 현재 적용된 효과(GOOD, FIREWORK)에 따라 화면 중앙에 이펙트 텍스트 출력.
// 일정 시간(displayDuration) 후 효과는 자동 해제됨.
function drawEffects() {
  if (currentEffect === "GOOD") {                     // GOOD 효과가 설정된 경우
    setTextStyle();
    textSize(48);
    fill(255, 215, 0);                                 // 금색 계열
    text("👍 GOOD!", width / 2, height / 2);           // 화면 중앙에 출력
    if (millis() - effectTimer > displayDuration)      // 효과 지속 시간 초과 시
      currentEffect = "";                              // 효과 종료
  }

  if (currentEffect === "FIREWORK") {                  // FIREWORK 효과인 경우
    setTextStyle();
    textSize(48);
    fill(255, 0, 0);                                   // 빨간 불꽃 이모지
    text("🎆🎆🎆", width / 2, height / 2);
    if (millis() - effectTimer > displayDuration)
      currentEffect = "";
  }

  if (currentEffect === "HEART") {
    setTextStyle();
    textSize(48);
    fill(255, 0, 127);
    text("❤️ LOVE!", width / 2, height / 2);
    if (millis() - effectTimer > displayDuration)
      currentEffect = "";
  }

  if (currentEffect === "SAD") {
    setTextStyle();
    textSize(48);
    fill(100, 100, 255);
    text("😢 So Sad...", width / 2, height / 2);
    if (millis() - effectTimer > displayDuration)
      currentEffect = "";
  }
}


// 손가락(index)의 좌표가 버튼 영역 내에 있는지 확인하고, 해당 기능 수행.
// Writing / Erase 모드 토글, 전체 지우기, 효과(GOOD/FIREWORK), 색상 선택창 등
function handleButtons(index) {
  let writeButtonX = width / 2 - 50;
  let writeButtonY = height - 80;

  // ✍️ 쓰기 모드 토글 버튼
  if (index.x > writeButtonX && index.x < writeButtonX + writeButtonW &&
      index.y > writeButtonY && index.y < writeButtonY + writeButtonH &&
      !showColorPicker) {
    if (millis() - lastToggleTime > toggleDelay) {
      isWritingMode = !isWritingMode;         // 모드 전환
      isEraseMode = false;                    // 동시에 지우기 모드는 끔
      lastToggleTime = millis();              // 토글 시간 기록
    }
  }

  let eraseModeButtonX = 30;
  let eraseModeButtonY = height - 80;

  // 🧼 지우기 모드 토글 버튼
  if (index.x > eraseModeButtonX && index.x < eraseModeButtonX + eraseModeButtonW &&
      index.y > eraseModeButtonY && index.y < eraseModeButtonY + eraseModeButtonH &&
      !showColorPicker) {
    if (millis() - lastToggleTime > toggleDelay) {
      isEraseMode = !isEraseMode;
      isWritingMode = false;                 // 쓰기 모드 비활성화
      lastToggleTime = millis();
    }
  }

  // 🗑 전체 지우기 버튼
  if (index.x > buttonX && index.x < buttonX + buttonW &&
      index.y > buttonY && index.y < buttonY + buttonH &&
      !showColorPicker) {
    allDrawings = [];                         // 모든 선 삭제
    currentPoints = [];                       // 현재 그리고 있던 선도 초기화
    isFirstPoint = true;
  }

  // 👍 GOOD 효과 버튼
  let goodButtonX = width - 130;
  let goodButtonY = height - 80;
  if (index.x > goodButtonX && index.x < goodButtonX + 100 &&
      index.y > goodButtonY && index.y < goodButtonY + 50 &&
      !showColorPicker) {
    if (currentEffect === "") {               // 효과 중첩 방지
      currentEffect = "GOOD";
      effectTimer = millis();
    }
  }

  // 🎆 FIREWORK 효과 버튼
  let fireworkButtonX = width - 250;
  let fireworkButtonY = height - 80;
  if (index.x > fireworkButtonX && index.x < fireworkButtonX + 100 &&
      index.y > fireworkButtonY && index.y < fireworkButtonY + 50 &&
      !showColorPicker) {
    if (currentEffect === "") {
      currentEffect = "FIREWORK";
      effectTimer = millis();
    }
  }

  // ❤️ HEART 효과 버튼
  let heartButtonX = width - 150;
  let heartButtonY = height - 390;
  if (index.x > heartButtonX && index.x < heartButtonX + 100 &&
      index.y > heartButtonY && index.y < heartButtonY + 50 &&
      !showColorPicker) {
    if (currentEffect === "") {
      currentEffect = "HEART";
      effectTimer = millis();
    }
  }

  // 😢 SAD 효과 버튼
  let sadButtonX = width - 150;
  let sadButtonY = height - 320;
  if (index.x > sadButtonX && index.x < sadButtonX + 100 &&
      index.y > sadButtonY && index.y < sadButtonY + 50 &&
      !showColorPicker) {
    if (currentEffect === "") {
      currentEffect = "SAD";
      effectTimer = millis();
    }
  }


  // 🎨 색상 선택 버튼
  let colorButtonX = width - 150;
  let colorButtonY = height - 460;
  if (index.x > colorButtonX && index.x < colorButtonX + 100 &&
      index.y > colorButtonY && index.y < colorButtonY + 50 &&
      currentEffect === "") {
    showColorPicker = true;                   // HSV 컬러 휠 표시
  }
}

function checkOKGesture(hand) {
  let thumb = hand.thumb_tip;
  let index = hand.index_finger_tip;
  let d = dist(thumb.x, thumb.y, index.x, index.y);
  return d < 50;
}


// 손가락이 버튼 위가 아닐 경우, OK 제스처와 현재 모드 상태에 따라 그리기 또는 지우기 수행.
function handleDrawing(hand, index) {
  if (isOverButton(index.x, index.y)) {                     // 버튼 위에서는 그리기/지우기 금지
    if (wasOKGesture && currentPoints.length > 0) {         // 손을 떼면 선 저장
      allDrawings.push({ points: [...currentPoints], col: currentStrokeColor });
      currentPoints = [];
      isFirstPoint = true;
    }
    wasOKGesture = false;
    return;
  }

  if (isEraseMode) {                                        // 지우기 모드일 경우
    eraseNearPoints(index.x, index.y);                      // 손가락 근처 점 삭제
  }

  // ✍️ 쓰기 모드이고 OK 제스처일 경우 선 그리기
  if (!isEraseMode && isWritingMode && checkOKGesture(hand)) {
    if (!wasOKGesture) {
      isFirstPoint = true;                                  // 선 그리기 초기화
      wasOKGesture = true;
    }
    if (isFirstPoint) {
      smoothX = index.x;
      smoothY = index.y;
      isFirstPoint = false;
    } else {
      smoothX = lerp(smoothX, index.x, 0.25);                // 움직임 보정
      smoothY = lerp(smoothY, index.y, 0.25);
    }
    currentPoints.push({ x: smoothX, y: smoothY });          // 현재 점 추가
  } else {
    if (wasOKGesture && currentPoints.length > 0) {          // 손을 떼면 현재 선 저장
      allDrawings.push({ points: [...currentPoints], col: currentStrokeColor });
      currentPoints = [];
      isFirstPoint = true;
    }
    wasOKGesture = false;
  }
}



// 점들을 부드럽게 이어서 곡선을 그림.
// 중간 좌표를 기준으로 curveVertex로 부드럽게 연결
function drawSmoothLine(pts) {
  if (pts.length < 2) return;                            // 점이 2개 미만이면 선 그릴 필요 없음
  beginShape();                                          // 곡선 그리기 시작
  for (let i = 1; i < pts.length - 1; i++) {
    let cx = (pts[i].x + pts[i + 1].x) / 2;              // 현재 점과 다음 점의 중간 x 좌표
    let cy = (pts[i].y + pts[i + 1].y) / 2;              // 현재 점과 다음 점의 중간 y 좌표
    curveVertex(cx, cy);                                // 부드러운 곡선 정점 추가
  }
  endShape();                                            // 곡선 그리기 종료
}


// 지우기 버튼을 화면에 그림
function drawEraseButton() {
  stroke(0);
  strokeWeight(2);
  fill(255, 0, 0, 180);
  rect(buttonX, buttonY, buttonW, buttonH, 10);
  setTextStyle();
  textSize(16);
  text("Erase All", buttonX + buttonW / 2, buttonY + buttonH / 2);
  noStroke();
}


// 쓰기 버튼을 화면에 그림
function drawWriteButton() {
  stroke(0);                                             // 테두리 색: 검정
  strokeWeight(2);                                       // 테두리 두께

  let writeButtonX = width / 2 - 50;                     // 버튼 X 위치 (중앙 기준)
  let writeButtonY = height - 80;                        // 버튼 Y 위치 (하단 여백)

  fill(isWritingMode ? color(0, 128, 255, 180)           // 쓰기 모드면 파랑
                     : color(128, 128, 128, 180));       // 아니면 회색
  rect(writeButtonX, writeButtonY, writeButtonW, writeButtonH, 10);  // 버튼 그리기

  setTextStyle();                                        // 텍스트 스타일 설정
  textSize(14);                                          // 텍스트 크기
  text(isWritingMode ? "Writing: ON"                    // 모드 텍스트 표시
                     : "Writing: OFF", 
       writeButtonX + writeButtonW / 2, 
       writeButtonY + writeButtonH / 2);
  noStroke();                                            // 이후 영향 제거
}


// 지우기 모드 버튼을 화면에 그림
function drawEraseModeButton() {
  stroke(0);                                             // 테두리 검정
  strokeWeight(2);                                       // 테두리 두께

  let eraseModeButtonX = 30;                             // 좌측 여백 위치
  let eraseModeButtonY = height - 80;

  fill(isEraseMode ? color(255, 0, 255, 180)             // ON이면 보라
                   : color(100, 100, 100, 180));         // OFF이면 회색
  rect(eraseModeButtonX, eraseModeButtonY, eraseModeButtonW, eraseModeButtonH, 10);  // 버튼 그리기

  setTextStyle();                                        // 텍스트 스타일 설정
  textSize(16);
  text(isEraseMode ? "Erase Mode: ON"                   // 모드 텍스트 표시
                   : "Erase Mode: OFF", 
       eraseModeButtonX + eraseModeButtonW / 2, 
       eraseModeButtonY + eraseModeButtonH / 2);
  noStroke();                                            // 이후 영향 제거
}


// 오른쪽 하단에 추가 버튼들을 그림
function drawRightButtons() {
  stroke(0);                                             // 테두리 설정
  strokeWeight(2);

  fill(255, 128, 0, 180);                                // 오렌지색 (Firework)
  rect(width - 250, height - 80, 100, 50, 10);           // Firework 버튼
  setTextStyle();
  textSize(14);
  text("🎆 Firework", width - 200, height - 55);

  fill(0, 200, 0, 180);                                  // 초록색 (Good)
  rect(width - 130, height - 80, 100, 50, 10);           // Good 버튼
  setTextStyle();
  text("👍 Good", width - 80, height - 55);

  fill(128, 0, 255, 180);                                // 보라색 (Color)
  rect(width - 150, height - 460, 100, 50, 10);          // Color 버튼
  setTextStyle();
  text("🎨 Color", width - 100, height - 435);

  fill(255, 0, 127, 180);                                // 핑크 (Heart)
  rect(width - 150, height - 390, 100, 50, 10);          // Heart 버튼
  setTextStyle();
  text("❤️ Heart", width - 100, height - 365);

  fill(100, 100, 255, 180);                              // 파랑 (Sad)
  rect(width - 150, height - 320, 100, 50, 10);          // Sad 버튼
  setTextStyle();
  text("😢 Sad", width - 100, height - 295);

  noStroke();                                            // 테두리 해제
}




// 손가락 좌표(x, y)를 기준으로 반경 내에 있는 점들을 삭제.
// 해당 선이 빈 배열이 되면 전체 선 삭제
function eraseNearPoints(x, y) {
  let eraseRadius = 25;                                  // 지우기 반경

  for (let d = allDrawings.length - 1; d >= 0; d--) {     // 모든 선을 역순으로 순회
    let drawing = allDrawings[d];

    for (let i = drawing.points.length - 1; i >= 0; i--) { // 각 선의 점들을 역순 순회
      let pt = drawing.points[i];
      if (dist(x, y, pt.x, pt.y) < eraseRadius) {         // 손 위치와 가까운 점 삭제
        drawing.points.splice(i, 1);
      }
    }

    if (drawing.points.length === 0) {                    // 점이 모두 지워졌다면 선도 삭제
      allDrawings.splice(d, 1);
    }
  }
}


// 텍스트 스타일을 설정하는 함수
function setTextStyle() {
  stroke(0);                                              // 텍스트 외곽선: 검정
  strokeWeight(2);                                        // 외곽선 두께
  fill(255);                                              // 텍스트 색상: 흰색
  textAlign(CENTER, CENTER);                              // 텍스트 정렬: 가로/세로 중앙
}


// 마우스 좌표가 버튼 영역에 포함되는지 확인
function isOverButton(x, y) {
  // 중앙 하단 쓰기 버튼 영역
  let writeButtonX = width / 2 - 50;
  let writeButtonY = height - 80;
  if (x > writeButtonX && x < writeButtonX + writeButtonW &&
      y > writeButtonY && y < writeButtonY + writeButtonH) return true;

  // 좌측 하단 지우기 모드 버튼 영역
  let eraseModeButtonX = 30;
  let eraseModeButtonY = height - 80;
  if (x > eraseModeButtonX && x < eraseModeButtonX + eraseModeButtonW &&
      y > eraseModeButtonY && y < eraseModeButtonY + eraseModeButtonH) return true;

  // 좌측 상단 전체 지우기 버튼
  if (x > buttonX && x < buttonX + buttonW &&
      y > buttonY && y < buttonY + buttonH) return true;

  // Good 버튼
  let goodButtonX = width - 130;
  let goodButtonY = height - 80;
  if (x > goodButtonX && x < goodButtonX + 100 &&
      y > goodButtonY && y < goodButtonY + 50) return true;

  // Firework 버튼
  let fireworkButtonX = width - 250;
  let fireworkButtonY = height - 80;
  if (x > fireworkButtonX && x < fireworkButtonX + 100 &&
      y > fireworkButtonY && y < fireworkButtonY + 50) return true;

  // Heart 버튼
  let heartButtonX = width - 150;
  let heartButtonY = height - 390;
  if (x > heartButtonX && x < heartButtonX + 100 &&
      y > heartButtonY && y < heartButtonY + 50) return true;

  // Sad 버튼
  let sadButtonX = width - 150;
  let sadButtonY = height - 320;
  if (x > sadButtonX && x < sadButtonX + 100 &&
      y > sadButtonY && y < sadButtonY + 50) return true;

  // Color 버튼
  let colorButtonX = width - 150;
  let colorButtonY = height - 460;
  if (x > colorButtonX && x < colorButtonX + 100 &&
      y > colorButtonY && y < colorButtonY + 50) return true;

  return false;                                           // 어떤 버튼에도 포함되지 않음
}


