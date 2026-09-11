Feature: integration QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @I01 @integration
  Scenario: I01 임시 저장과 공개 분리
    Given 공개된 앨리스 도서가 있다
    When 관리자에서 제목을 바꾸고 임시 저장만 한다
    Then 관리자는 변경 제목을 보며 사용자 화면은 기존 제목을 표시한다

  @I02 @integration
  Scenario: I02 관리자 편집에서 공개와 사용자 확인까지
    Given 관리자가 공개 도서를 편집한다
    When 제목을 변경해 공개하고 사용자 화면을 새로 연다
    Then 변경한 책 제목이 사용자 첫 화면과 책장에 표시된다

  @I03 @integration
  Scenario: I03 비공개 전환 후 책장 제외
    Given 공개 중인 앨리스가 있다
    When 공개 대상 체크를 해제하고 공개한다
    Then 사용자 책장에서 앨리스가 사라지고 오즈는 남는다

  @I04 @integration
  Scenario: I04 저자 및 권리 정보 없는 공개 차단
    Given 공개 대상 도서의 저자와 권리 정보가 비어 있다
    When 공개를 누른다
    Then 누락 정보 안내가 나오며 공개 데이터는 그대로 유지된다

  @I05 @integration
  Scenario: I05 메인 모델 없는 챕터 공개 차단
    Given 새 공개 대상 책에 모델이 없다
    When 임시 저장 후 공개를 누른다
    Then 초안 저장은 되고 공개는 메인 모델 안내와 함께 거부된다

  @I06 @integration
  Scenario: I06 저장 오류 후 수정 내용 유지와 재시도
    Given 책 제목을 수정한 상태에서 저장 요청이 실패한다
    When 실패 안내를 확인한 뒤 다시 저장한다
    Then 편집 내용이 보존되고 두 번째 저장이 성공한다

  @I07 @integration
  Scenario: I07 다른 창의 저장과 충돌 처리
    Given 두 관리자 창이 같은 도서를 열었다
    When 첫 창에서 저장한 뒤 오래된 둘째 창이 저장한다
    Then 둘째 창은 덮어쓰지 않고 충돌을 알린다

  @I08 @integration
  Scenario: I08 저장 중 버튼 중복 요청 방지
    Given 변경 내용을 저장하는 응답이 대기 중이다
    When 저장 중 저장 및 공개 버튼을 확인한다
    Then 두 버튼을 비활성화하고 완료 후 활성화한다
