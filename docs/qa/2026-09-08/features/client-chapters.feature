Feature: client-chapters QA 및 UAT
  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.

  @C17 @client-chapters
  Scenario: C17 공개 챕터 직접 접속: 흰 토끼를 따라서
    Given alice의 alice-1가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C18 @client-chapters
  Scenario: C18 공개 챕터 직접 접속: 작아지는 문, 커지는 세계
    Given alice의 alice-2가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C19 @client-chapters
  Scenario: C19 공개 챕터 직접 접속: 버섯 숲의 수수께끼
    Given alice의 alice-3가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C20 @client-chapters
  Scenario: C20 공개 챕터 직접 접속: 끝나지 않는 티 파티
    Given alice의 alice-4가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C21 @client-chapters
  Scenario: C21 공개 챕터 직접 접속: 장미 정원의 여왕
    Given alice의 alice-5가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C22 @client-chapters
  Scenario: C22 공개 챕터 직접 접속: 꿈에서 깨어나는 시간
    Given alice의 alice-6가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C23 @client-chapters
  Scenario: C23 공개 챕터 직접 접속: 노란 벽돌 길
    Given oz의 oz-1가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C24 @client-chapters
  Scenario: C24 공개 챕터 직접 접속: 함께 걷는 숲
    Given oz의 oz-2가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다

  @C25 @client-chapters
  Scenario: C25 공개 챕터 직접 접속: 집으로 가는 마음
    Given oz의 oz-3가 공개되어 있다
    When 해당 챕터 주소로 접속하고 독서 창을 확인한다
    Then 챕터 제목과 비어 있지 않은 본문 및 3D 장면을 표시한다
