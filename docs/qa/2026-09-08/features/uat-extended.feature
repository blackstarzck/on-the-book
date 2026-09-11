Feature: uat-extended QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @J01 @uat-extended
  Scenario: J01 새 책과 새 GLB 모델의 공개 독서 전체 과정
    Given 관리자가 새 공개 도서를 준비한다
    When 새 책을 만들고 GLB를 등록 및 배치한 뒤 본문을 작성해 공개한다
    Then 사용자 책장에서 새 책을 골라 모델과 본문을 볼 수 있다

  @J02 @uat-extended
  Scenario: J02 저장 도중 추가 수정의 미저장 상태 표시
    Given 책 제목의 첫 변경을 저장 중이다
    When 응답이 오기 전에 제목을 다시 변경한다
    Then 첫 변경만 저장되고 두 번째 변경은 미저장으로 표시한다

  @J03 @uat-extended
  Scenario: J03 나가기 중 저장 실패와 재시도
    Given 저장되지 않은 도서 제목 변경이 있다
    When 저장 후 나가기의 첫 요청을 실패시키고 다시 시도한다
    Then 나가기 창과 변경 내용을 보존하고 재시도 성공 후 나간다

  @J04 @uat-extended
  Scenario: J04 모든 도서를 비공개로 전환
    Given 공개 도서 2권이 있다
    When 각 책의 공개 대상을 해제하고 공개한다
    Then 사용자 화면에 준비 중 안내를 표시한다

  @J05 @uat-extended
  Scenario: J05 바닥 그림 드래그와 크기 저장
    Given 도서 편집 화면에 기본 바닥 이미지가 있다
    When 화살표 그림을 장면에 놓고 크기를 바꾼 뒤 저장한다
    Then 바닥 그림의 위치와 크기가 저장된다

  @J06 @uat-extended
  Scenario: J06 등록한 미사용 모델 삭제
    Given 새 GLB 모델을 보관함에 등록했다
    When 아직 배치하지 않은 모델을 삭제하고 저장한다
    Then 보관함에서 모델이 사라진다

  @J07 @uat-extended
  Scenario: J07 메인 모델 대체 삭제 저장
    Given 메인과 보조 모델이 있는 챕터
    When 메인 삭제 시 보조 모델을 대체로 선택한다
    Then 기존 메인은 제거되고 선택한 보조 모델이 메인이 된다

  @J08 @uat-extended
  Scenario: J08 본문 표시 해제와 사용자 반영
    Given 첫 챕터에서 모델 접근 시 본문을 표시한다
    When 본문과 카메라 연출 옵션을 해제한 뒤 공개한다
    Then 해당 챕터에서 본문 창 없이 탐험할 수 있다
