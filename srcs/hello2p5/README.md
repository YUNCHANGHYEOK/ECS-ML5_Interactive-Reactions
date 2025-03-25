# 프로젝트 이름: Hello2P5

## 소개
이 프로젝트는 `p5.js`를 사용하여 간단한 그래픽 및 인터랙션을 구현한 기본 예제입니다.
`ml5`와 `webSerial`라이브러리를 포함하고 있기 때문에 머신 러닝 프로젝트와 
아두이노 연결 프로젝트에 활용하기 쉽습니다.

## 주요 기능
- 그래픽 렌더링
- 사용자 입력 처리
- 애니메이션 구현

## 설치 및 실행
1. 이 저장소를 클론합니다:
    ```bash
    git clone https://github.com/bjc97r/hello2p5.git
    ```
2. 프로젝트 폴더를 vscode로 오픈합니다.
    ```bash
    code hello2p5
    ```
3. 아직 다음 extension이 설치되지 않았다면 설치해 주세요.
    - p5.vscode
    - Turbo Console Log

4. 최상위 폴더의 `index.html` 파일, 또는 examples 폴더의 하위 폴더에 있는 `index.html` 파일을 vscode에서 열고 vscode 하단의 오른쪽에 있는 [Go Live]를 클릭합니다. 새로운 웹브라우저 창에서 실행이 됩니다. 실행을 종료하기 위해서는
하단의 오른쪽에 있는 [Port: 5500]을 클릭하여 로컬 웹서버를 종료합니다. 


## 새로운 p5 프로젝트 시작하기기
- git-bash 터미널에서 examples 폴더의 하위 폴더 가운데 가장 유사한 폴더를 복사하여 작업합니다. 
    ```bash
    cd examples
    cp -a drawCircles newCircles
    ```
