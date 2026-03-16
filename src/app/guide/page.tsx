// =============================================================================
// 使い方ガイド - 初参加から使いこなすまでの完全マニュアル
// ロール別フィルタ対応、専門用語解説付き
// =============================================================================

import { getCurrentMember } from '@/lib/auth/get-member';
import Link from 'next/link';
import GuideFilter from './GuideFilter';

// ---------------------------------------------------------------------------
// ガイドデータ
// ---------------------------------------------------------------------------

interface GuideStep {
  number: number;
  title: string;
  who: 'all' | 'manager' | 'admin';
  whoLabel: string;
  where: string;
  href: string;
  hrefNote?: string; // 「ここから該当期間を選んでください」等の補足
  what: string;
  why: string;
  next: string;
}

interface GuidePhase {
  id: string;
  title: string;
  timing: string;
  color: string;
  description: string;
  steps: GuideStep[];
}

const GUIDE_PHASES: GuidePhase[] = [
  // =========================================================================
  // Phase 0: はじめに
  // =========================================================================
  {
    id: 'first',
    title: 'はじめに',
    timing: 'ログイン直後',
    color: 'border-[#22c55e]',
    description: 'システムに初めてアクセスしたらまずやることです。全員共通。',
    steps: [
      {
        number: 1,
        title: 'Googleアカウントでログインする',
        who: 'all',
        whoLabel: '全社員',
        where: 'ログイン画面',
        href: '/login',
        what: '「Googleアカウントでログイン」ボタンを押して、会社で使っているGoogleアカウントを選びます。事前に管理者があなたのメールアドレスを登録している必要があります。',
        why: 'ログインすると、メールアドレスからあなたのメンバー情報（名前・等級・所属事業部）が自動的に紐づきます。ログインできない場合は、管理者にメールアドレスの登録を依頼してください。',
        next: 'ログインするとダッシュボードが表示されます。',
      },
      {
        number: 2,
        title: 'ダッシュボードで全体を把握する',
        who: 'all',
        whoLabel: '全社員',
        where: 'ダッシュボード',
        href: '/dashboard',
        what: 'ログイン後に最初に表示されるページです。全社の評価状況・事業部ごとの成績・人件費ROI（投資対効果）・クロスセル実績が一覧で確認できます。事業部名をクリックすると事業部詳細へ、メンバー名をクリックすると個人詳細へ移動できます。',
        why: '「今、会社全体がどういう状態か」を把握する起点です。管理者はここで事業部間の差や改善点を発見し、一般メンバーは自分の位置づけを確認します。',
        next: 'プロフィールで自分の情報と通知設定を確認しておきます。',
      },
      {
        number: 3,
        title: 'プロフィールと通知設定を確認する',
        who: 'all',
        whoLabel: '全社員',
        where: 'プロフィール',
        href: '/profile',
        what: '自分の名前・等級・所属事業部が正しいか確認します。通知設定（Slack/LINEのON/OFF）もここで変更できます。情報が間違っている場合は管理者に修正を依頼してください。',
        why: '通知をONにしておくと、評価期間の開始やOKRチェックインのリマインドが届くので忘れずに対応できます。',
        next: '管理者はシステムの初期設定へ。一般メンバーは次のフェーズまで待ちましょう。',
      },
    ],
  },

  // =========================================================================
  // Phase 1: 初期セットアップ（管理者のみ）
  // =========================================================================
  {
    id: 'setup',
    title: '初期セットアップ',
    timing: 'システム導入時（1回だけ）',
    color: 'border-[#737373]',
    description: '管理者（G4/G5）がシステムの土台を作ります。一般メンバーは読み飛ばしてOKです。',
    steps: [
      {
        number: 4,
        title: '組織情報・等級・バリューを設定する',
        who: 'admin',
        whoLabel: '代表(G5)',
        where: '管理 > システム設定',
        href: '/admin/settings',
        what: '組織名、会計年度の開始月（通常4月）を設定します。等級（G1〜G5）の名称と給与レンジ、バリュー項目（会社が大切にする価値観、例: 「大胆に挑戦する」）、評価ランクのしきい値（90点以上がSランクなど）と昇給額も定義します。',
        why: 'すべての評価計算の基盤です。ランクのしきい値は「何点でSランクか」を決める設定で、後から変更も可能です。',
        next: '次は事業部を作ります。',
      },
      {
        number: 5,
        title: '事業部を登録する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > 事業部管理',
        href: '/admin/divisions',
        what: '会社の事業部（例: システム開発事業部、ASP事業部）を登録し、それぞれ「黒字」か「投資中」のフェーズを設定します。',
        why: '事業部のフェーズで評価の重みが変わります。黒字事業部は売上などの数字（定量KPI）が50%を占め、投資中の事業部は行動や姿勢（定性評価）が45%を占めます。',
        next: '次はメンバーを登録します。',
      },
      {
        number: 6,
        title: 'メンバーを登録して事業部に配属する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > メンバー管理',
        href: '/admin/members',
        what: '全社員の名前・Googleメールアドレス・等級（G1〜G5）・月給を登録し、所属事業部に配属します。事業部長は「事業部長フラグ」をONにします。',
        why: 'ここで登録しないとその人はシステムにログインできません。メールアドレスが正しくないとGoogleログインとの紐づけが失敗するので注意してください。',
        next: '次はKPI項目を定義します。',
      },
      {
        number: 7,
        title: 'KPI評価項目を定義する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > KPIテンプレート',
        href: '/admin/kpi-templates',
        what: '事業部と職種（営業・エンジニア等）の組み合わせごとに、何を数字で評価するか（KPI = 重要業績指標、例: 受注売上、契約件数）を定義します。各項目のウェイト（配分%）とランク判定基準も設定します。',
        why: 'ここで定義した項目が、社員の自己評価画面に自動表示されます。事業部の戦略に合った指標を設定してください。',
        next: '次は通知を設定します。',
      },
      {
        number: 8,
        title: '通知チャンネルを設定する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > 通知管理',
        href: '/admin/notifications',
        what: 'Slack・LINE・ChatWorkのWebhook URL（通知の送り先アドレス）を登録し、どのタイミング（評価開始、OKRリマインド等）で通知を飛ばすか選択します。テスト送信で動作確認もできます。',
        why: '設定しなくてもシステムは使えますが、通知があると「自己評価の締め切りが近い」等のリマインドが届き、対応漏れを防げます。',
        next: '初期セットアップ完了。次は評価期間の作成です。',
      },
    ],
  },

  // =========================================================================
  // Phase 2: 期間設定と目標
  // =========================================================================
  {
    id: 'planning',
    title: '期間設定と目標設定',
    timing: '半期の開始時（4月・10月）',
    color: 'border-[#f59e0b]',
    description: '新しい半期が始まったら管理者が期間を作成し、全社員がOKR（目標）を設定します。',
    steps: [
      {
        number: 9,
        title: '評価期間とOKR期間を作成する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > 評価期間管理',
        href: '/admin/eval-periods',
        what: '半期の評価期間（例: 2026年度 H1）を作成し、ステータスを「目標設定」に進めます。同時に「OKR期間管理」で四半期期間（例: Q1）も作成し、「評価期間管理」の「OKR」ボタンで紐付けます。',
        why: '評価期間を作らないと社員が自己評価を開始できません。OKR期間の紐付けにより、OKRの達成度が半期評価に自動反映されます。',
        next: '次は財務データを入力します。',
      },
      {
        number: 10,
        title: '事業部の財務データを入力する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: '管理 > 財務データ',
        href: '/admin/financials',
        what: '事業部ごとの月次売上・原価・販管費を入力します。粗利と営業利益は自動計算されます。月1回、5分程度の作業です。',
        why: 'ダッシュボードのROI（投資対効果 = 売上に対する人件費の割合）が実データベースで計算されます。また、営業利益が黒字か赤字かで事業部のフェーズが自動判定され、評価の配分比率が決まります。',
        next: 'ここから全社員のターンです。OKRを設定しましょう。',
      },
      {
        number: 11,
        title: 'OKR（目標と成果指標）を設定する',
        who: 'all',
        whoLabel: '全社員',
        where: 'OKR',
        href: '/objectives',
        what: 'OKR = Objectives and Key Results（目標と主要な成果指標）のこと。「新規作成」ボタンから四半期の目標（Objective = 達成したい状態、例: 「顧客満足度を業界トップにする」）を登録し、それを測るKey Result（成果指標、例: 「NPS 50以上」「解約率1%以下」）を2〜5個設定します。',
        why: 'OKRは「何に集中するか」を明確にする仕組みです。達成率70%でも成功とされる、挑戦的な目標を掲げるのがコツです。全社→事業部→個人の順に目標がツリー構造でつながります。',
        next: '目標設定が終わったら、日々の運用に入ります。',
      },
    ],
  },

  // =========================================================================
  // Phase 3: 日常運用
  // =========================================================================
  {
    id: 'daily',
    title: '日常の活動',
    timing: '四半期を通じて毎週・毎月',
    color: 'border-[#3b82f6]',
    description: '目標設定後の日々の活動です。毎週のチェックインを中心に、1on1やクロスセルを記録していきます。',
    steps: [
      {
        number: 12,
        title: '毎週OKRチェックインをする',
        who: 'all',
        whoLabel: '全社員',
        where: '週次チェックイン',
        href: '/checkin',
        what: '自分のKey Resultの今週の実績値と自信度（「四半期末までに達成できそうか」を5段階で回答）を入力して保存します。所要時間は5分程度です。',
        why: '毎週の進捗が蓄積されることで、OKR詳細ページに進捗グラフが描かれます。自信度が低いKRは、1on1で上長に相談して早めに対策を打てます。',
        next: '入力した内容はOKR一覧やダッシュボードに即反映されます。',
      },
      {
        number: 13,
        title: '1on1面談を記録する',
        who: 'manager',
        whoLabel: 'マネージャー(G3+)',
        where: '1on1 > 新規記録',
        href: '/one-on-one/new',
        what: '部下との面談内容を記録します。メンバーを選ぶとそのメンバーのOKR進捗が自動表示されるので、それを見ながらOKR進捗・障壁・次回までのアクションを記入して保存します。過去の記録は「1on1 > 履歴」で確認できます。',
        why: '記録を残すことで前回のアクション追跡ができます。評価時やフィードバック面談の参考資料にもなります。',
        next: '定期的に続けることで部下の成長を追跡できます。',
      },
      {
        number: 14,
        title: 'クロスセル（トスアップ）を登録する',
        who: 'all',
        whoLabel: '全社員',
        where: 'クロスセル',
        href: '/toss',
        what: '他の事業部に紹介できるお客様がいたら、紹介経路と受け取り担当者を選んでメモを書いて登録します。登録後は一覧からステータスを「進行中」→「受注」と更新していきます。成約時は粗利を入力するとボーナスが自動計算されます。',
        why: '事業部間の連携で全社の売上向上につなげます。成約するとトス元・受注側の両方にインセンティブがもらえます。全社の紹介状況は「クロスセルマップ」で視覚的に確認できます。',
        next: 'ボーナス結果は「クロスセル > ボーナス結果」ページで確認できます。',
      },
      {
        number: 15,
        title: 'ウィンセッションに投稿する',
        who: 'all',
        whoLabel: '全社員',
        where: 'ウィンセッション',
        href: '/win-session',
        what: '今週うまくいったこと、嬉しかったことを投稿して全社で共有します。カテゴリ（受注・顧客成功・プロダクト等）を選んで本文を書くだけです。自分の投稿は削除もできます。',
        why: '小さな成功でも共有することでチーム全体の士気が上がります。他事業部の成功事例からクロスセルのヒントが見つかることもあります。',
        next: '毎週の習慣にすると効果的です。',
      },
    ],
  },

  // =========================================================================
  // Phase 4: 四半期レビュー
  // =========================================================================
  {
    id: 'review',
    title: '四半期OKRレビュー',
    timing: '四半期末（6月・9月・12月・3月）',
    color: 'border-[#a855f7]',
    description: '四半期が終わったらOKRの最終結果を振り返ります。ここで確定したスコアが半期評価に反映されます。',
    steps: [
      {
        number: 16,
        title: 'OKRの最終達成度を入力する',
        who: 'all',
        whoLabel: '全社員',
        where: '四半期レビュー',
        href: '/review',
        what: '各Key Resultの最終達成度（0.0〜1.0、つまり0%〜100%）を入力して提出します。毎週のチェックインの最終値を元に、実際の結果を確定させます。',
        why: 'ここで確定した達成度が半期評価の総合スコアに自動で組み込まれます。正直に振り返ることが次の四半期の改善につながります。',
        next: '半期末にはさらに自己評価が始まります。',
      },
    ],
  },

  // =========================================================================
  // Phase 5: 自己評価
  // =========================================================================
  {
    id: 'self-eval',
    title: '自己評価',
    timing: '半期末（9月・3月）',
    color: 'border-[#22d3ee]',
    description: '管理者が評価期間を「自己評価」フェーズに進めたら、全社員が半期を振り返って自己評価を入力・提出します。入力は「査定履歴」から該当期間を選んで開始します。',
    steps: [
      {
        number: 17,
        title: '定量KPI（数字の成果）を入力する',
        who: 'all',
        whoLabel: '全社員',
        where: '査定履歴 > 該当期間 > 定量KPI',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選んでください',
        what: 'KPI（重要業績指標）= 数字で測れる成果指標のこと。事業部・職種ごとに設定されたKPI項目（例: 受注売上、新規契約数）の目標値と実績値を入力します。達成率とランクが自動計算されます。',
        why: '黒字事業部では評価全体の50%を占める最重要セクションです。正確な数字を入力してください。',
        next: '次は定性評価（行動の振り返り）です。',
      },
      {
        number: 18,
        title: '定性評価（行動の振り返り）を入力する',
        who: 'all',
        whoLabel: '全社員',
        where: '査定履歴 > 該当期間 > 定性評価',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選んでください',
        what: '定性評価 = 数字では測れない行動面の評価のこと。行動評価項目ごとに4段階（期待超え / 基準達成 / やや不足 / 不十分）で自己評価し、「こういう場面でこう行動した結果、こうなった」という具体的なエピソードをコメントに書きます。',
        why: '上長があなたの行動を客観的に評価するための重要な材料です。具体的なエピソードがあるほど、公正な評価につながります。',
        next: '次はバリュー評価です。',
      },
      {
        number: 19,
        title: 'バリュー評価を入力する',
        who: 'all',
        whoLabel: '全社員',
        where: '査定履歴 > 該当期間 > バリュー評価',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選んでください',
        what: 'バリュー = 会社が大切にする価値観のこと（例: Be Bold / Build Together / Own the Numbers）。各バリューに対して自分がどう体現したかをスコアとエビデンス（根拠となるエピソード）で記入します。',
        why: '評価全体の20〜25%を占めます。会社の価値観への貢献度を可視化する仕組みです。',
        next: '3つ全て入力したら提出です。',
      },
      {
        number: 20,
        title: '自己評価を確認して提出する',
        who: 'all',
        whoLabel: '全社員',
        where: '査定履歴 > 該当期間 > サマリー',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選んでください',
        what: '3つのカテゴリの入力内容とスコアを確認し、今期の振り返りコメントを書いて「自己評価を提出」を押します。推定ランクと推定昇給額も表示されます。',
        why: '提出すると上長に通知が届き、上長評価が開始されます。提出後は変更できないので、内容をよく確認してから提出してください。',
        next: 'あとは上長があなたの評価をしてくれるのを待ちます。',
      },
    ],
  },

  // =========================================================================
  // Phase 6: 上長評価
  // =========================================================================
  {
    id: 'manager-eval',
    title: '上長評価',
    timing: '自己評価提出後',
    color: 'border-[#a855f7]',
    description: 'マネージャー（G3以上）が部下の自己評価を参照しながら、上長としてのスコアをつけます。',
    steps: [
      {
        number: 21,
        title: '部下の自己評価を確認して上長スコアをつける',
        who: 'manager',
        whoLabel: 'マネージャー(G3+)',
        where: '査定履歴 > 該当期間 > 上長評価',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選び、対象メンバーを選択してください',
        what: '部下が提出した自己評価（定量KPIの実績・定性行動のエピソード・バリュー体現度）を参照しながら、定性行動とバリューに上長としてのスコアをつけます。部下が上の等級の行動基準を満たしている項目には「上位等級行動」フラグを設定します（1〜2項目で+1ランク、3項目以上で+2ランクのボーナス）。',
        why: '自己評価だけでは甘めになりがちです。上長が客観的に評価することで公平性を保ちます。',
        next: '全セクション入力したら提出です。',
      },
      {
        number: 22,
        title: '上長コメントを書いて提出する',
        who: 'manager',
        whoLabel: 'マネージャー(G3+)',
        where: '査定履歴 > 該当期間 > 上長サマリー',
        href: '/history',
        hrefNote: '「査定履歴」から該当する評価期間を選んでください',
        what: 'スコアサマリー・推定ランク・推定昇給額を確認し、メンバーへのコメント（良かった点・改善点）と次期アクションを書いて「上長評価を提出」を押します。',
        why: '提出すると総合スコアとランクが自動計算されます。全マネージャーの提出が揃ったら、キャリブレーション（全社での評価調整）に進みます。',
        next: '次はキャリブレーションです。',
      },
    ],
  },

  // =========================================================================
  // Phase 7: キャリブレーション〜確定
  // =========================================================================
  {
    id: 'calibration',
    title: 'キャリブレーション〜確定',
    timing: '上長評価完了後',
    color: 'border-[#22d3ee]',
    description: 'キャリブレーション = 事業部間の評価バラつきを調整する作業です。調整後、全社員にフィードバック面談を実施し、評価を最終確定します。',
    steps: [
      {
        number: 23,
        title: 'ランク分布を調整する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: 'キャリブレーション',
        href: '/calibration',
        what: '全社員の総合スコア・ランクを一覧で確認し、事業部間でバラつきがないか調整します。目標分布（S:5-10%, A:20-25%, B:40-50%, C:15-20%, D:5-10%）と比較しながら、必要に応じてランクを変更して確定します。',
        why: '評価者（上長）によって甘い・厳しいの差が出るのを防ぎ、全社で公平な評価にします。ここで確定したランクが昇給額を決定します。',
        next: 'フィードバック面談を実施します。',
      },
      {
        number: 24,
        title: 'フィードバック面談を実施して記録する',
        who: 'manager',
        whoLabel: 'マネージャー(G3+)',
        where: 'フィードバック',
        href: '/feedback',
        what: '部下一人ずつと面談し、確定した評価結果（ランク・スコア・上長コメント）を直接伝えます。良かった点・改善点を話し合い、面談メモを記録して「FB実施完了」を押します。',
        why: '評価は伝えてこそ意味があります。本人の感想も聞き、次期に向けたアクションを合意してください。面談完了後、本人が「評価結果」ページで結果を閲覧できるようになります。',
        next: '全員のフィードバックが終わったら評価を確定します。',
      },
      {
        number: 25,
        title: '評価を最終確定する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: 'フィードバック',
        href: '/feedback',
        what: 'フィードバック実施済みの評価に「評価確定」ボタンを押して最終確定します。評価期間管理で「クローズ」に進めて今期の評価サイクルを終了します。',
        why: '確定すると変更できなくなり、今期の評価が正式に完了します。',
        next: '社員が結果を確認できるようになります。',
      },
    ],
  },

  // =========================================================================
  // Phase 8: 結果と次期
  // =========================================================================
  {
    id: 'results',
    title: '結果確認と次のサイクルへ',
    timing: '評価確定後',
    color: 'border-[#22c55e]',
    description: '全社員が自分の評価結果を確認し、C/Dランクのメンバーには改善計画を作成します。そして次の半期へ。',
    steps: [
      {
        number: 26,
        title: '自分の評価結果を確認する',
        who: 'all',
        whoLabel: '全社員',
        where: '評価結果',
        href: '/results',
        what: '総合スコア・ランク（S〜D）・昇給額・カテゴリ別スコア・上長コメント・次期アクション・昇格適格性が確認できます。印刷/PDF出力も可能です。',
        why: '自分の強み・弱みを客観的に把握し、次期の目標設定に活かします。Sランクは即昇格検討対象、2期連続Aは昇格候補になります。',
        next: 'C/Dランクの場合は改善計画が作成されます。',
      },
      {
        number: 27,
        title: 'C/Dランクメンバーの改善計画を作成する',
        who: 'manager',
        whoLabel: 'マネージャー(G3+)',
        where: '改善計画',
        href: '/improvement-plans',
        what: 'C/Dランクのメンバーに対して具体的な改善目標とマイルストーン（小さな中間目標）を設定します。マイルストーンにはチェックボックスがあり、1on1で進捗を確認しながらチェックを入れていきます。改善が進んだら「計画完了」で終了します。',
        why: '改善計画なしにC/Dを放置すると次期も同じ結果になります。具体的な目標と定期的なフォローで次期の評価向上を目指します。',
        next: 'フォローは日常の1on1（ステップ13）で行います。',
      },
      {
        number: 28,
        title: '四半期インセンティブを処理する',
        who: 'admin',
        whoLabel: 'G4/G5',
        where: 'インセンティブ',
        href: '/quarterly-bonus',
        what: 'KPI達成・OKRストレッチ・特別の各インセンティブを登録し、「承認」→「支払確定」と処理します。社員は「クロスセル > ボーナス結果」で自分のボーナスを確認できます。',
        why: '評価とは別の四半期ごとの報奨制度です。タイムリーに処理することで成果への即時フィードバックになります。',
        next: 'そして次の半期のサイクルが始まります。ステップ9に戻りましょう。',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------

export default async function GuidePage() {
  const member = await getCurrentMember();

  const isAdmin = member && ['G4', 'G5'].includes(member.grade);
  const isManager = member && ['G3', 'G4', 'G5'].includes(member.grade);
  const userRole: 'admin' | 'manager' | 'all' = isAdmin ? 'admin' : isManager ? 'manager' : 'all';

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] tracking-wider">
            使い方ガイド
          </h1>
          <p className="text-sm text-[#a3a3a3] mt-2 leading-relaxed">
            このシステムの使い方を1から順番に説明します。
            上から読み進めるだけで、評価サイクル全体の流れがわかります。
          </p>
          {member && (
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                {member.grade}
              </span>
              <span className="text-xs text-[#737373]">
                {isAdmin
                  ? 'すべてのステップが対象です'
                  : isManager
                    ? '管理者向けステップ以外が対象です'
                    : '「全社員」のステップが対象です'}
              </span>
            </div>
          )}
        </div>

        {/* フィルタ + フロー図 */}
        <GuideFilter
          phases={GUIDE_PHASES.map((p) => ({ id: p.id, title: p.title, color: p.color }))}
          userRole={userRole}
        />

        {/* 各フェーズ */}
        {GUIDE_PHASES.map((phase) => (
          <div key={phase.id} id={phase.id} className="space-y-4">
            <div className={`border-l-2 ${phase.color} pl-4`}>
              <h2 className="text-lg font-bold text-[#e5e5e5] tracking-wider">
                {phase.title}
              </h2>
              <div className="text-xs text-[#737373] mt-1">{phase.timing}</div>
              <p className="text-sm text-[#a3a3a3] mt-2">{phase.description}</p>
            </div>

            {phase.steps.map((step) => {
              const isForMe =
                step.who === 'all' ||
                (isManager && step.who === 'manager') ||
                (isAdmin);

              return (
                <div
                  key={step.number}
                  data-who={step.who}
                  className={`guide-step border bg-[#0a0a0a] ${
                    isForMe ? 'border-[#1a1a1a]' : 'border-[#111111] opacity-40'
                  }`}
                >
                  <div className="border-b border-[#1a1a1a] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                          {step.number}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-[#e5e5e5]">{step.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                              step.who === 'admin' ? 'text-[#f59e0b] border-[#f59e0b]'
                                : step.who === 'manager' ? 'text-[#a855f7] border-[#a855f7]'
                                  : 'text-[#22d3ee] border-[#22d3ee]'
                            }`}>
                              {step.whoLabel}
                            </span>
                            <span className="text-[11px] text-[#737373]">{step.where}</span>
                          </div>
                        </div>
                      </div>
                      <Link
                        href={step.href}
                        className="flex-shrink-0 px-3 py-1.5 border border-[#333333] text-[11px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                      >
                        開く
                      </Link>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {step.hrefNote && (
                      <div className="text-[11px] text-[#f59e0b] bg-[#f59e0b]/5 border border-[#f59e0b]/20 px-3 py-1.5">
                        {step.hrefNote}
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] text-[#737373] uppercase tracking-wider mb-1">やること</div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">{step.what}</p>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#737373] uppercase tracking-wider mb-1">なぜ必要か</div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">{step.why}</p>
                    </div>
                    <div className="border-t border-[#111111] pt-2">
                      <p className="text-xs text-[#22d3ee]">{step.next}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* フッター */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center space-y-2">
          <p className="text-sm text-[#a3a3a3]">
            以上が評価サイクルの全28ステップです。このサイクルが半期ごとに繰り返されます。
          </p>
          <p className="text-xs text-[#737373]">
            各ページの右下にある「?」ボタンからも、そのページの詳しい操作ガイドを確認できます。
          </p>
        </div>
      </div>
    </div>
  );
}
