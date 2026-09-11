Feature: movement-layout QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @Z07 @movement-layout
  Scenario: Z07 모바일 편집 장면의 조작 공간
    Given 390×844 화면에서 도서를 편집한다
    When 화면 중앙의 장면을 직접 조작할 수 있는지 확인한다
    Then 편집 패널이 중앙의 3D 장면을 전부 가리지 않는다

  @Z08 @movement-layout
  Scenario: Z08 걸어서 다음 챕터로 자연스럽게 이동
    Given 첫 챕터의 메인 모델 앞에서 탐험 중이다
    When 오른쪽 방향키로 챕터 경계를 넘는다
    Then 별도 이동 버튼 없이 둘째 챕터로 바뀐다

  @Z09 @movement-layout
  Scenario: Z09 같은 모델에 재접근하면 첫 글귀부터 읽기
    Given 메인 모델의 글귀를 두 번째 페이지로 넘겼다
    When 모델에서 멀어졌다가 챕터 지도로 다시 접근한다
    Then 첫 페이지부터 글귀를 읽는다
