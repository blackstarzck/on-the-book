Feature: client-navigation QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @C09 @client-navigation
  Scenario: C09 다음 챕터와 이전 챕터 이동
    Given 첫 챕터에 있는 사용자
    When 다음 버튼을 누른 뒤 이전 버튼을 누른다
    Then 장면 이름과 주소가 각각 둘째 및 첫째 챕터로 바뀐다

  @C10 @client-navigation
  Scenario: C10 마지막 방문 챕터 이어 읽기
    Given 셋째 챕터를 방문해 기록이 저장되었다
    When 홈으로 돌아가 책 속으로 들어간다
    Then 셋째 챕터부터 이어서 시작한다

  @C11 @client-navigation
  Scenario: C11 잘못된 책 주소에서 복구
    Given 존재하지 않는 책 식별자가 주소에 있다
    When 사용자 화면을 연다
    Then 오류 없이 첫 공개 도서를 표시한다

  @C12 @client-navigation
  Scenario: C12 잘못된 챕터 주소에서 복구
    Given 올바른 책과 존재하지 않는 챕터 주소
    When 사용자 화면을 연다
    Then 첫 챕터를 탐험할 수 있다

  @C13 @client-navigation
  Scenario: C13 지도에서 현재 챕터 재선택
    Given 둘째 챕터 탐험 중이다
    When 지도에서 같은 챕터를 다시 선택한다
    Then 지도는 닫히고 장면과 주소가 유지된다

  @C14 @client-navigation
  Scenario: C14 글귀 페이지 앞뒤 이동과 끝 경계
    Given 첫 챕터 메인 모델 근처에 도착했다
    When 글귀를 끝까지 넘긴 뒤 한 페이지 돌아간다
    Then 글귀가 바뀌고 첫 페이지와 마지막 페이지의 이동이 제한된다

  @C15 @client-navigation
  Scenario: C15 모델에서 멀어지면 독서 창 숨김
    Given 메인 모델 근처에서 글귀가 보인다
    When 아래 방향키를 눌러 충분히 멀어진다
    Then 글귀가 숨겨지고 이동을 계속할 수 있다

  @C16 @client-navigation
  Scenario: C16 도서 전환 후 다른 책의 첫 장면
    Given 앨리스 탐험 중이다
    When 책장에서 오즈를 고르고 탐험을 시작한다
    Then 오즈의 첫 챕터와 해당 책의 지도를 표시한다
