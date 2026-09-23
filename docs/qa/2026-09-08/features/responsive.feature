Feature: responsive QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @PC390 @responsive
  Scenario: PC390 client 화면 크기 390×844
    Given 390×844 화면의 사용자
    When client 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PA390 @responsive
  Scenario: PA390 admin 화면 크기 390×844
    Given 390×844 화면의 사용자
    When admin 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PC768 @responsive
  Scenario: PC768 client 화면 크기 768×1024
    Given 768×1024 화면의 사용자
    When client 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PA768 @responsive
  Scenario: PA768 admin 화면 크기 768×1024
    Given 768×1024 화면의 사용자
    When admin 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PC1024 @responsive
  Scenario: PC1024 client 화면 크기 1024×768
    Given 1024×768 화면의 사용자
    When client 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PA1024 @responsive
  Scenario: PA1024 admin 화면 크기 1024×768
    Given 1024×768 화면의 사용자
    When admin 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PC1600 @responsive
  Scenario: PC1600 client 화면 크기 1600×1000
    Given 1600×1000 화면의 사용자
    When client 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @PA1600 @responsive
  Scenario: PA1600 admin 화면 크기 1600×1000
    Given 1600×1000 화면의 사용자
    When admin 첫 화면과 주요 동작을 확인한다
    Then 가로 넘침 없이 주요 버튼을 실제로 누를 수 있다

  @P09 @responsive
  Scenario: P09 작은 화면의 편집 주요 도구 접근
    Given 390×844 화면의 관리자
    When 책을 열어 저장 및 공개와 도구 영역을 확인한다
    Then 주요 편집 버튼이 화면 안에 있고 서로 겹쳐 가려지지 않는다

  @P10 @responsive
  Scenario: P10 동작 줄이기 설정에서 화면 이동
    Given 운영체제의 동작 줄이기를 선택했다
    When 사용자 화면에서 다음 챕터로 이동한다
    Then 화면이 멈추지 않고 다음 챕터를 표시한다
