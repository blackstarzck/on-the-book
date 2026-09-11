Feature: uploads QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @U01 @uploads
  Scenario: U01 손상된 GLB 거부
    Given 새 모델 등록창이 열려 있다
    When invalid.glb 파일을 선택한다
    Then 등록 실패 이유를 알리고 저장 버튼을 다시 사용할 수 있다

  @U02 @uploads
  Scenario: U02 뼈대 없는 GLB 거부
    Given 새 모델 등록창이 열려 있다
    When unrigged.glb 파일을 선택한다
    Then 등록 실패 이유를 알리고 저장 버튼을 다시 사용할 수 있다

  @U03 @uploads
  Scenario: U03 25MB 초과 GLB 거부
    Given 새 모델 등록창이 열려 있다
    When oversize.glb 파일을 선택한다
    Then 등록 실패 이유를 알리고 저장 버튼을 다시 사용할 수 있다

  @U04 @uploads
  Scenario: U04 정상 애니메이션 모델 등록과 저장
    Given 유효한 애니메이션 GLB 파일이 준비되어 있다
    When 이름과 사용 권한 및 파일을 입력하고 보관함에 등록한 뒤 저장한다
    Then 모델과 애니메이션 정보가 보관함에 저장된다

  @U05 @uploads
  Scenario: U05 파일 없이 모델 등록 차단
    Given 이름과 사용 권한만 입력된 새 모델
    When 파일을 선택하지 않고 보관함 등록을 누른다
    Then 유효한 파일을 먼저 등록하도록 안내한다

  @U06 @uploads
  Scenario: U06 사용 중인 모델 삭제 차단
    Given 토끼 모델이 여러 챕터에 배치되어 있다
    When 모델 정보에서 삭제를 누른다
    Then 장면에서 먼저 제거하도록 안내하고 모델을 유지한다

  @U07 @uploads
  Scenario: U07 잘못된 표지 이미지 거부: invalid.png
    Given 도서 정보창이 열려 있다
    When invalid.png을 표지로 선택한다
    Then 파일 오류를 안내하고 변경 적용 버튼을 다시 사용할 수 있다

  @U08 @uploads
  Scenario: U08 잘못된 표지 이미지 거부: oversize.png
    Given 도서 정보창이 열려 있다
    When oversize.png을 표지로 선택한다
    Then 파일 오류를 안내하고 변경 적용 버튼을 다시 사용할 수 있다

  @U09 @uploads
  Scenario: U09 표지 이미지 등록과 사용자 반영
    Given 유효한 PNG 파일과 공개 도서가 있다
    When 표지를 올려 적용하고 공개한다
    Then 사용자 책장에 등록한 표지가 로드된다

  @U10 @uploads
  Scenario: U10 바닥 이미지 등록과 저장
    Given 도서 편집 화면이 열려 있다
    When PNG 바닥 이미지를 등록하고 저장한 뒤 다시 연다
    Then 등록 이미지가 바닥 이미지 목록에 남는다
