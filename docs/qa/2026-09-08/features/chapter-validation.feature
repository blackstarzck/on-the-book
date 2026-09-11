Feature: chapter-validation QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @B01 @chapter-validation
  Scenario: B01 챕터 입력 검증: 가로 하한 미만
    Given 챕터 설정창이 열려 있다
    When 가로 하한 미만 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B02 @chapter-validation
  Scenario: B02 챕터 입력 검증: 가로 상한 초과
    Given 챕터 설정창이 열려 있다
    When 가로 상한 초과 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B03 @chapter-validation
  Scenario: B03 챕터 입력 검증: 세로 하한 미만
    Given 챕터 설정창이 열려 있다
    When 세로 하한 미만 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B04 @chapter-validation
  Scenario: B04 챕터 입력 검증: 세로 상한 초과
    Given 챕터 설정창이 열려 있다
    When 세로 상한 초과 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B05 @chapter-validation
  Scenario: B05 챕터 입력 검증: 페이지 글자 수 하한 미만
    Given 챕터 설정창이 열려 있다
    When 페이지 글자 수 하한 미만 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B06 @chapter-validation
  Scenario: B06 챕터 입력 검증: 페이지 글자 수 상한 초과
    Given 챕터 설정창이 열려 있다
    When 페이지 글자 수 상한 초과 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B07 @chapter-validation
  Scenario: B07 챕터 입력 검증: 카메라 여백 상한 초과
    Given 챕터 설정창이 열려 있다
    When 카메라 여백 상한 초과 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다

  @B08 @chapter-validation
  Scenario: B08 챕터 입력 검증: 접근 배율 상한 초과
    Given 챕터 설정창이 열려 있다
    When 접근 배율 상한 초과 값을 입력하고 변경 적용을 누른다
    Then 잘못된 입력을 차단하고 설정창을 유지한다
