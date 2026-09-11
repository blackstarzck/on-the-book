Feature: book-validation QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @V01 @book-validation
  Scenario: V01 도서 입력 검증: 빈 제목
    Given 새 책 정보 입력창이 열려 있다
    When 빈 제목을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V02 @book-validation
  Scenario: V02 도서 입력 검증: 빈 영문 제목
    Given 새 책 정보 입력창이 열려 있다
    When 빈 영문 제목을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V03 @book-validation
  Scenario: V03 도서 입력 검증: 출간 연도 하한 미만
    Given 새 책 정보 입력창이 열려 있다
    When 출간 연도 하한 미만을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V04 @book-validation
  Scenario: V04 도서 입력 검증: 출간 연도 상한 초과
    Given 새 책 정보 입력창이 열려 있다
    When 출간 연도 상한 초과을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V05 @book-validation
  Scenario: V05 도서 입력 검증: 정수가 아닌 연도
    Given 새 책 정보 입력창이 열려 있다
    When 정수가 아닌 연도을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V06 @book-validation
  Scenario: V06 도서 입력 검증: 잘못된 출처 주소
    Given 새 책 정보 입력창이 열려 있다
    When 잘못된 출처 주소을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V07 @book-validation
  Scenario: V07 도서 입력 검증: 실행 가능한 출처 주소
    Given 새 책 정보 입력창이 열려 있다
    When 실행 가능한 출처 주소을 입력하고 책 만들기를 누른다
    Then 입력창을 유지하고 잘못된 입력을 차단한다

  @V08 @book-validation
  Scenario: V08 공백으로만 된 제목 차단
    Given 새 책 정보 입력창이 열려 있다
    When 제목에 공백만 입력하고 책을 만든다
    Then 책 생성 전에 의미 있는 제목을 요청한다

  @V09 @book-validation
  Scenario: V09 문자열을 HTML로 실행하지 않음
    Given 새 책 제목에 특수문자가 포함된다
    When 태그와 한글 및 이모지가 있는 제목으로 책을 만든다
    Then 문자열을 그대로 표시하고 스크립트를 실행하지 않는다

  @V10 @book-validation
  Scenario: V10 새 비공개 책의 기본 챕터와 저장
    Given 관리자가 새 책을 만들 수 있다
    When 정상 제목으로 비공개 책을 만들고 임시 저장한다
    Then 기본 챕터 1개와 비공개 상태로 저장되고 사용자 책장에는 없다
