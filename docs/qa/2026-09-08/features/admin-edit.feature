Feature: admin-edit QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @E01 @admin-edit
  Scenario: E01 저장 전 편집 내용 유지
    Given 앨리스의 도서 편집 화면이다
    When 책 제목을 바꾸고 나가기에서 계속 편집을 누른다
    Then 편집 화면과 바꾼 제목이 유지된다

  @E02 @admin-edit
  Scenario: E02 저장하지 않고 나가기
    Given 책 제목을 변경했지만 저장하지 않았다
    When 저장하지 않고 나가기를 선택한 뒤 책을 다시 연다
    Then 기존 제목으로 되돌아온다

  @E03 @admin-edit
  Scenario: E03 저장 후 나가기
    Given 책 제목을 변경했지만 저장하지 않았다
    When 저장 후 나가기를 선택하고 새로고침한다
    Then 도서 목록에 변경한 제목이 남는다

  @E04 @admin-edit
  Scenario: E04 실행 취소와 다시 실행
    Given 도서 제목 변경을 적용했다
    When 실행 취소 후 다시 실행한다
    Then 원래 제목과 변경한 제목이 순서대로 복원된다

  @E05 @admin-edit
  Scenario: E05 챕터 이동 중 같은 3D 화면 유지
    Given 앨리스 편집 화면이 열려 있다
    When 여러 챕터를 순서대로 선택한다
    Then 선택한 챕터가 활성화되고 3D 화면이 재생성되지 않는다

  @E06 @admin-edit
  Scenario: E06 챕터 이름과 본문 저장
    Given 기존 첫 챕터를 편집한다
    When 제목과 한글 및 이모지 본문을 바꾼 뒤 저장하고 다시 연다
    Then 입력한 챕터 제목과 본문이 유지된다

  @E07 @admin-edit
  Scenario: E07 챕터 순서 키보드 변경과 취소
    Given 앨리스의 첫 챕터가 선택되어 있다
    When 순서 손잡이에서 Alt+아래를 누르고 실행 취소한다
    Then 챕터 순서가 바뀌고 취소하면 원래 순서가 된다

  @E08 @admin-edit
  Scenario: E08 챕터 추가를 취소하면 원상 복귀
    Given 기존 챕터 개수를 확인했다
    When 챕터 추가를 누른 뒤 입력창을 닫는다
    Then 추가 확정 전 취소한 챕터는 남지 않는다

  @E09 @admin-edit
  Scenario: E09 마지막 챕터 삭제 방지
    Given 기본 챕터가 하나뿐인 새 책
    When 챕터 설정을 연다
    Then 유일한 챕터의 삭제 버튼이 비활성이다

  @E10 @admin-edit
  Scenario: E10 도서 삭제 확인에서 취소
    Given 기존 도서의 삭제를 요청한다
    When 삭제 확인창에서 취소한다
    Then 도서와 챕터가 유지된다
