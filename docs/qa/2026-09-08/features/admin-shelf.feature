Feature: admin-shelf QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @A01 @admin-shelf
  Scenario: A01 관리자 도서 보관함
    Given 로컬 관리자 화면에 접속한다
    When 도서 목록과 저장 및 공개 버튼을 확인한다
    Then 기존 책 2권과 검색 및 상태 필터가 표시된다

  @A02 @admin-shelf
  Scenario: A02 도서 제목 검색
    Given 도서가 여러 권 존재한다
    When 앨리스를 검색한다
    Then 앨리스만 표시된다

  @A03 @admin-shelf
  Scenario: A03 검색 결과 없음과 검색 해제
    Given 관리자가 도서 목록에 있다
    When 없는 제목을 검색한 뒤 검색어를 지운다
    Then 빈 결과 안내 후 모든 도서가 다시 표시된다

  @A04 @admin-shelf
  Scenario: A04 공개 상태별 필터
    Given 기존 책 두 권이 공개 대상이다
    When 비공개 초안과 공개 대상을 차례로 고른다
    Then 각 조건에 맞는 도서만 표시된다

  @A05 @admin-shelf
  Scenario: A05 모델 보관함 검색
    Given 기본 모델 9개가 존재한다
    When 모델 보관함에서 토끼를 검색한다
    Then 일치하는 모델만 표시된다

  @A06 @admin-shelf
  Scenario: A06 설정 파일 내려받기
    Given 관리자에 책과 모델 데이터가 있다
    When 공개 및 안내에서 설정 내려받기를 누른다
    Then 설정 백업 파일이 내려받아진다

  @A07 @admin-shelf
  Scenario: A07 사용자 화면 새 창 링크
    Given 관리자 도서 보관함에 있다
    When 사용자 화면 열기를 누른다
    Then 새 창에서 사용자 화면이 정상 표시된다

  @A08 @admin-shelf
  Scenario: A08 스튜디오 요청 실패와 재시도
    Given 관리자 데이터 응답에 일시 장애가 있다
    When 다시 시도를 누른다
    Then 오류 안내 후 도서 보관함으로 복구한다
