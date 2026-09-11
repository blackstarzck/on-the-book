Feature: accessibility QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @X01 @accessibility
  Scenario: X01 사용자 버튼의 이름 제공
    Given 사용자 탐험 화면이 열려 있다
    When 보조 기술이 버튼을 읽을 수 있는지 확인한다
    Then 보이는 모든 버튼에 읽을 수 있는 이름이 있다

  @X02 @accessibility
  Scenario: X02 도서 정보창 키보드 초점 제한
    Given 도서 정보창이 열려 있다
    When Tab 키로 여러 번 이동한다
    Then 입력창 뒤의 편집 요소로 초점이 이동하지 않는다

  @X03 @accessibility
  Scenario: X03 키보드로 첫 화면의 탐험 시작
    Given 마우스를 사용하지 않는 사용자
    When 시작 버튼에 초점을 두고 Enter를 누른다
    Then 탐험 화면과 사용 안내가 열린다

  @X04 @accessibility
  Scenario: X04 모델 검색의 빈 결과 안내
    Given 관리자 모델 보관함
    When 존재하지 않는 모델 이름을 검색한다
    Then 검색 결과가 없음을 읽을 수 있는 문장으로 알린다
