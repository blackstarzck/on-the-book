Feature: edge-cases QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @Z01 @edge-cases
  Scenario: Z01 겹치는 모델 반응 범위 저장 방지
    Given 모델이 여러 개 있는 챕터
    When 첫 모델의 반응 범위를 최대치로 늘린다
    Then 겹침을 안내하고 기존 범위를 유지한다

  @Z02 @edge-cases
  Scenario: Z02 공간 축소 시 외부 모델 검사
    Given 모델을 현재 챕터 안쪽의 X=26 위치로 옮겼다
    When 가로와 세로 크기를 최소값으로 줄인다
    Then 외부로 벗어나는 배치를 알리고 변경 적용을 막는다

  @Z03 @edge-cases
  Scenario: Z03 기본 제공 모델의 정보 수정
    Given 기본 토끼 모델의 편집 버튼이 있다
    When 모델 이름을 수정하고 적용한다
    Then 모델 종류를 보존하면서 이름이 변경된다

  @Z04 @edge-cases
  Scenario: Z04 모바일 방향 버튼으로 이동
    Given 390×844에서 첫 챕터 본문을 보고 있다
    When 뒤로 이동 버튼을 누른 채 유지한다
    Then 캐릭터가 이동해 본문 표시 영역에서 벗어난다

  @Z05 @edge-cases
  Scenario: Z05 탐험 중 새로고침으로 챕터 유지
    Given 지도에서 다섯째 챕터로 이동했다
    When 브라우저를 새로고침한다
    Then 다섯째 챕터와 본문을 그대로 표시한다

  @Z06 @edge-cases
  Scenario: Z06 영문 검색의 대소문자 무시
    Given 영문 제목으로 새 도서를 저장했다
    When 소문자로 도서 제목을 검색한다
    Then 대문자가 포함된 같은 도서를 찾는다
