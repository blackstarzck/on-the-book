Feature: client-recovery QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @R1 @client-recovery
  Scenario: R1 손상된 방문 기록 복구 1
    Given 브라우저 방문 기록이 올바른 형식이 아니다
    When 사용자 화면을 열고 탐험을 시작한다
    Then 화면이 멈추지 않고 첫 챕터를 탐험할 수 있다

  @R2 @client-recovery
  Scenario: R2 손상된 방문 기록 복구 2
    Given 브라우저 방문 기록이 올바른 형식이 아니다
    When 사용자 화면을 열고 탐험을 시작한다
    Then 화면이 멈추지 않고 첫 챕터를 탐험할 수 있다

  @R3 @client-recovery
  Scenario: R3 손상된 방문 기록 복구 3
    Given 브라우저 방문 기록이 올바른 형식이 아니다
    When 사용자 화면을 열고 탐험을 시작한다
    Then 화면이 멈추지 않고 첫 챕터를 탐험할 수 있다

  @R4 @client-recovery
  Scenario: R4 손상된 방문 기록 복구 4
    Given 브라우저 방문 기록이 올바른 형식이 아니다
    When 사용자 화면을 열고 탐험을 시작한다
    Then 화면이 멈추지 않고 첫 챕터를 탐험할 수 있다

  @R05 @client-recovery
  Scenario: R05 책장 요청 실패 후 재시도
    Given 책장 응답이 일시적으로 실패한다
    When 오류 화면에서 다시 시도를 누른다
    Then 오류 안내 후 정상 첫 화면으로 복구한다

  @R06 @client-recovery
  Scenario: R06 공개 도서가 없는 책장
    Given 공개 도서 목록이 비어 있다
    When 사용자 화면에 접속한다
    Then 새로운 이야기를 준비한다는 안내가 보인다

  @R07 @client-recovery
  Scenario: R07 3D 미지원 브라우저의 본문 대안
    Given 브라우저가 3D 그래픽을 지원하지 않는다
    When 사용자 화면에서 이야기 읽기를 누른다
    Then 3D 오류 안내와 함께 본문 및 원작 링크를 읽을 수 있다

  @R08 @client-recovery
  Scenario: R08 저장 공간 쓰기 실패 안내
    Given 브라우저가 방문 기록 저장을 거부한다
    When 처음 탐험을 시작한다
    Then 탐험을 유지하면서 저장 불가 안내를 표시한다

  @R09 @client-recovery
  Scenario: R09 응답이 느릴 때 중복 진입 방지
    Given 책장 응답이 대기 중이다
    When 사용자가 초기 로딩 상태를 확인한다
    Then 로딩을 알리고 응답이 끝나면 시작 버튼이 표시된다
