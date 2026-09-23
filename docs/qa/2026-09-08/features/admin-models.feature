Feature: admin-models QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @M01 @admin-models
  Scenario: M01 모델 선택과 위치 속성
    Given 모델이 있는 첫 챕터의 편집 화면
    When 모델 목록의 첫 모델을 선택한다
    Then 모델 이름과 실제 위치 및 애니메이션 설정을 확인할 수 있다

  @M02 @admin-models
  Scenario: M02 모델 높이 변경 저장
    Given 첫 챕터 모델을 선택했다
    When 높이를 2로 바꾸고 임시 저장한다
    Then 저장된 모델의 높이가 2이다

  @M03 @admin-models
  Scenario: M03 메인 모델 변경
    Given 첫 챕터에 여러 모델이 있다
    When 보조 모델을 선택해 메인 모델로 지정하고 저장한다
    Then 새 메인 모델이 목록과 저장 데이터에 반영된다

  @M04 @admin-models
  Scenario: M04 메인 모델 삭제 시 대체 모델 필수
    Given 메인 모델과 보조 모델들이 있다
    When 메인 모델 삭제를 누르고 대체 모델 없이 확정한다
    Then 대체 모델 선택창을 유지한다

  @M05 @admin-models
  Scenario: M05 모델 복제
    Given 첫 챕터의 모델이 선택되어 있다
    When 복제를 누른다
    Then 겹치지 않는 위치에 고유 식별자를 가진 모델이 하나 추가된다

  @M06 @admin-models
  Scenario: M06 첫 모델을 드래그해 배치
    Given 모델이 없는 새 책의 챕터
    When 기본 토끼 모델을 월드로 끌어 놓는다
    Then 모델이 추가되며 자동으로 메인 모델이 된다

  @M07 @admin-models
  Scenario: M07 편집 도구 단축키와 Escape
    Given 모델을 선택한 편집 화면
    When E, S, R, Escape를 차례로 누른다
    Then 방향, 크기, 범위, 이동 도구가 각각 활성화된다

  @M08 @admin-models
  Scenario: M08 관리자 독자 체험과 편집 복귀
    Given 편집 중인 챕터가 있다
    When 독자 체험에서 다른 챕터를 보고 편집으로 돌아온다
    Then 본문과 장면을 체험하고 원래 편집 화면으로 돌아온다
