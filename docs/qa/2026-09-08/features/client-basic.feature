Feature: client-basic QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @C01 @client-basic
  Scenario: C01 첫 화면과 실제 3D 장면
    Given 공개된 도서가 있는 새 브라우저
    When 사용자 첫 화면에 접속한다
    Then 책 제목과 시작 버튼 및 3D 화면이 보인다

  @C02 @client-basic
  Scenario: C02 처음 탐험할 때 사용 안내
    Given 탐험 기록이 없는 사용자
    When 책 속으로 들어가기를 누른다
    Then 사용 안내가 열리고 닫은 뒤 탐험할 수 있다

  @C03 @client-basic
  Scenario: C03 반복 방문 시 안내를 중복 표시하지 않음
    Given 사용 안내를 이미 본 사용자
    When 책 속으로 다시 들어간다
    Then 안내창 없이 탐험을 시작한다

  @C04 @client-basic
  Scenario: C04 도서 선택과 표지 정보
    Given 사용자가 첫 화면에 있다
    When 책장에서 오즈의 마법사를 선택한다
    Then 선택한 책 제목과 작가 및 장면 수가 표시된다

  @C05 @client-basic
  Scenario: C05 사용 안내의 키보드 닫기와 초점 복귀
    Given 첫 화면에서 안내 버튼에 초점을 둔다
    When 안내를 열고 Escape를 누른다
    Then 안내가 닫히고 원래 버튼으로 초점이 돌아온다

  @C06 @client-basic
  Scenario: C06 소리 켜기와 끄기
    Given 사용자 화면에서 소리가 꺼져 있다
    When 소리 버튼을 두 번 누른다
    Then 버튼의 이름과 켜짐 상태가 순서대로 바뀐다

  @C07 @client-basic
  Scenario: C07 첫 챕터의 이전 이동 제한
    Given 첫 챕터에 접속한 사용자
    When 챕터 이동 버튼을 확인한다
    Then 이전 버튼은 비활성이고 다음 버튼은 활성이다

  @C08 @client-basic
  Scenario: C08 마지막 챕터의 다음 이동 제한
    Given 마지막 챕터에 접속한 사용자
    When 챕터 이동 버튼을 확인한다
    Then 다음 버튼은 비활성이고 이전 버튼은 활성이다
