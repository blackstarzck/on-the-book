Feature: auth-basic QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @S01 @auth-basic
  Scenario: S01 비로그인 관리자 접근 보호
    Given 비밀번호 보호가 켜진 별도 환경
    When 관리자 화면에 접속한다
    Then 로그인 화면이 표시되고 도서 편집 화면은 보이지 않는다

  @S02 @auth-basic
  Scenario: S02 빈 비밀번호 차단
    Given 관리자 로그인 화면
    When 비밀번호 없이 입장을 누른다
    Then 필수 입력을 요구하고 로그인 화면을 유지한다

  @S03 @auth-basic
  Scenario: S03 잘못된 비밀번호 안내
    Given 관리자 로그인 화면
    When 틀린 비밀번호를 제출한다
    Then 비밀번호가 일치하지 않는다는 안내가 표시된다

  @S04 @auth-basic
  Scenario: S04 올바른 로그인과 새로고침 유지
    Given 올바른 테스트 비밀번호가 있다
    When 로그인한 뒤 새로고침한다
    Then 로그인 상태와 관리자 보관함이 유지된다

  @S05 @auth-basic
  Scenario: S05 로그아웃 후 관리자 접근 차단
    Given 로그인한 관리자
    When 로그아웃을 누르고 관리자 화면을 다시 연다
    Then 로그인 화면으로 돌아간다

  @S06 @auth-basic
  Scenario: S06 인증 없는 초안 미리보기 차단
    Given 로그인하지 않은 사용자
    When 초안 미리보기 주소에 접속한다
    Then 초안 내용 대신 관리자 로그인 필요 안내를 표시한다

  @S07 @auth-basic
  Scenario: S07 인증 없이 공개 독서 가능
    Given 비밀번호 보호가 켜진 환경의 일반 사용자
    When 사용자 첫 화면에 접속한다
    Then 로그인 요구 없이 공개 도서를 볼 수 있다

  @S08 @auth-basic
  Scenario: S08 세션 종료 후 편집 저장 거부
    Given 로그인 후 제목을 편집했다
    When 세션을 지우고 저장을 누른다
    Then 로그인 필요 안내를 표시하며 편집 내용은 유지한다
