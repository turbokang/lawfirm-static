import { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.PUBLIC_API_BASE || '/api';

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
}

interface SurveyStep {
  step_id: string;
  title: string;
  question: string;
  input_type: 'single_choice' | 'multi_choice' | 'number' | 'yes_no' | 'form' | 'info';
  options?: { value: string; label: string }[];
  validation?: { fields?: FormField[] };
  category?: string;
  progress?: number;
  total_steps?: number;
  is_first?: boolean;
  is_last?: boolean;
  help_text?: string;
}

interface FormField {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  tooltip?: string;
  group?: string;
  condition?: string;
}

interface SurveyResult {
  repayment_rate: number;
  monthly_repayment_total: number;
  total_repayment: number;
  total_debt: number;
  secured_debt: number;
  unsecured_debt: number;
  monthly_income: number;
  living_expenses: number;
  monthly_available: number;
}

export default function SurveyWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: `안녕하세요! 👋 아크로 AI 상담사입니다.<br><br>
        몇 가지 질문에 답해주시면 <strong>예상 변제율</strong>과 <strong>월 변제금</strong>을 계산해드릴게요.<br><br>
        약 3분 정도 소요됩니다.`
    }
  ]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<SurveyStep | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, any>>({});
  const [chatStepCount, setChatStepCount] = useState(0);
  const [surveyResult, setSurveyResult] = useState<SurveyResult | null>(null);
  const [isFreeChatMode, setIsFreeChatMode] = useState(false);
  const [freeChatInput, setFreeChatInput] = useState('');
  const [formValues, setFormValues] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (content: string, type: 'bot' | 'user') => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const formatNumber = (value: string): string => {
    const num = value.replace(/[^0-9]/g, '');
    if (num) {
      return parseInt(num, 10).toLocaleString('ko-KR');
    }
    return '';
  };

  const parseFormattedNumber = (str: string): number => {
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
  };

  const startSurvey = async () => {
    setIsStarted(true);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error('세션 생성 실패');

      const data = await response.json();
      setSessionId(data.session_id);
      setSessionAnswers({});
      setChatStepCount(0);

      addMessage('좋아요! 그럼 시작해볼게요. 😊', 'bot');

      await loadStep(data.session_id);
    } catch (error) {
      console.error('Error:', error);
      addMessage('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'bot');
      setIsStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStep = async (sid?: string) => {
    const id = sid || sessionId;
    if (!id) return;

    try {
      const response = await fetch(`${API_BASE}/sessions/${id}/step`);
      if (!response.ok) throw new Error('단계 로드 실패');

      const step: SurveyStep = await response.json();
      setCurrentStep(step);
      setSelectedAnswers([]);
      setFormValues({});

      if (step.input_type === 'info') {
        await showResult();
        return;
      }

      setTimeout(() => {
        addMessage(`<strong>${step.title}</strong><br>${step.question}`, 'bot');
      }, 500);
    } catch (error) {
      console.error('Error:', error);
      addMessage('단계를 불러오는데 실패했습니다.', 'bot');
    }
  };

  const selectOption = (value: string) => {
    if (!currentStep) return;

    if (currentStep.input_type === 'single_choice' || currentStep.input_type === 'yes_no') {
      setSelectedAnswers([value]);
      setTimeout(() => submitAnswer([value]), 300);
    } else {
      setSelectedAnswers(prev => {
        if (prev.includes(value)) {
          return prev.filter(v => v !== value);
        }
        return [...prev, value];
      });
    }
  };

  const submitAnswer = async (answers?: string[]) => {
    if (!currentStep || !sessionId) return;

    let answer: any;
    let answerText = '';

    if (currentStep.input_type === 'number') {
      const input = document.getElementById('chatNumberInput') as HTMLInputElement;
      answer = parseFormattedNumber(input?.value || '0');
      if (isNaN(answer) || answer === 0) {
        alert('숫자를 입력해주세요.');
        return;
      }
      answerText = answer.toLocaleString() + '원';
    } else if (currentStep.input_type === 'form') {
      answer = { ...formValues };
      answerText = '재산 정보 입력 완료';
    } else if (currentStep.input_type === 'single_choice' || currentStep.input_type === 'yes_no') {
      answer = answers?.[0] || selectedAnswers[0];
      if (!answer) {
        alert('항목을 선택해주세요.');
        return;
      }
      const option = currentStep.options?.find(o => o.value === answer);
      answerText = option?.label || answer;
    } else {
      answer = answers || selectedAnswers;
      if (answer.length === 0) {
        alert('항목을 선택해주세요.');
        return;
      }
      answerText = answer.map((v: string) => {
        const option = currentStep.options?.find(o => o.value === v);
        return option?.label || v;
      }).join(', ');
    }

    addMessage(answerText, 'user');
    setIsLoading(true);

    try {
      const newSessionAnswers = { ...sessionAnswers, [currentStep.step_id]: answer };
      setSessionAnswers(newSessionAnswers);

      const response = await fetch(`${API_BASE}/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: currentStep.step_id, answer })
      });

      if (!response.ok) throw new Error('응답 제출 실패');

      const result = await response.json();

      if (result.is_complete) {
        await showResult();
      } else if (result.next_step_id) {
        setChatStepCount(prev => prev + 1);
        await loadStep();
      }
    } catch (error) {
      console.error('Error:', error);
      addMessage('죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.', 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  const showResult = async () => {
    setShowLoadingOverlay(true);

    const stages = [
      '재산 정보 확인 중...',
      '청산가치 계산 중...',
      '가용소득 산정 중...',
      '변제율 시뮬레이션 중...',
      '최종 결과 생성 중...'
    ];

    let stageIndex = 0;
    setLoadingText(stages[0]);

    const interval = setInterval(() => {
      stageIndex++;
      if (stageIndex < stages.length) {
        setLoadingText(stages[stageIndex]);
      }
    }, 1200);

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/calculate-with-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      clearInterval(interval);
      setShowLoadingOverlay(false);

      if (!response.ok) throw new Error('계산 실패');

      const result: SurveyResult = await response.json();
      setSurveyResult(result);

      const saved = result.unsecured_debt - result.total_repayment;

      const resultHTML = `
        분석이 완료되었습니다.
        <div class="chat-result-card">
          <div class="chat-result-title">변제계획 요약</div>
          <div class="chat-result-row highlight">
            <span class="chat-result-label">예상 변제율</span>
            <span class="chat-result-value primary">${result.repayment_rate.toFixed(1)}%</span>
          </div>
          <div class="chat-result-divider"></div>
          <div class="chat-result-row">
            <span class="chat-result-label">총 채무</span>
            <span class="chat-result-value">${result.total_debt.toLocaleString()}원</span>
          </div>
          ${result.secured_debt > 0 ? `
          <div class="chat-result-row">
            <span class="chat-result-label">└ 별제권 (담보)</span>
            <span class="chat-result-value">${result.secured_debt.toLocaleString()}원</span>
          </div>` : ''}
          <div class="chat-result-row">
            <span class="chat-result-label">${result.secured_debt > 0 ? '└ 무담보 채무' : '무담보 채무'}</span>
            <span class="chat-result-value">${result.unsecured_debt.toLocaleString()}원</span>
          </div>
          <div class="chat-result-divider"></div>
          <div class="chat-result-row">
            <span class="chat-result-label">총 변제액 (36개월)</span>
            <span class="chat-result-value">${result.total_repayment.toLocaleString()}원</span>
          </div>
          <div class="chat-result-row">
            <span class="chat-result-label">월 변제금</span>
            <span class="chat-result-value">${result.monthly_repayment_total.toLocaleString()}원</span>
          </div>
          <div class="chat-result-divider"></div>
          <div class="chat-result-row highlight">
            <span class="chat-result-label">예상 탕감액</span>
            <span class="chat-result-value accent">${saved.toLocaleString()}원</span>
          </div>
        </div>
      `;

      addMessage(resultHTML, 'bot');

      setTimeout(() => {
        addMessage(`
          위 결과는 입력하신 정보를 바탕으로 한 예상치입니다.<br><br>
          <strong>궁금한 점이 있으시면 자유롭게 질문해주세요!</strong><br>
          예: "도박 빚도 가능한가요?", "필요 서류가 뭔가요?" 등
        `, 'bot');
        setIsFreeChatMode(true);
        setCurrentStep(null);
      }, 800);

    } catch (error) {
      console.error('Error:', error);
      clearInterval(interval);
      setShowLoadingOverlay(false);
      addMessage('결과 계산 중 오류가 발생했습니다. 다시 시도해주세요.', 'bot');
    }
  };

  const sendFreeChat = async () => {
    if (!freeChatInput.trim()) return;

    const text = freeChatInput.trim();
    addMessage(text, 'user');
    setFreeChatInput('');
    setIsLoading(true);

    setTimeout(() => {
      let response = '';
      const lowerText = text.toLowerCase();

      if (lowerText.includes('서류')) {
        response = '<strong>기본 필요 서류</strong><br><br>• 신분증 사본<br>• 주민등록등본<br>• 소득증빙서류 (급여명세서/소득금액증명원)<br>• 부채증명서 (금융기관별)<br><br><strong>아크로 서비스 포함사항:</strong> 부채증명서 발급대행을 무료로 해드립니다.';
      } else if (lowerText.includes('환불') || lowerText.includes('기각')) {
        response = '<strong>기각시 100% 환불 보장</strong><br><br>저희 아크로는 AI 정밀 분석을 통해 기각 확률을 최소화합니다.<br><br>만약 저희 과실로 기각될 경우 <strong>전액 환불</strong>해 드립니다. (단, 채무자 귀책사유 제외)';
      } else if (lowerText.includes('도박') || lowerText.includes('주식') || lowerText.includes('코인')) {
        response = '<strong>도박/투자 빚도 가능합니다!</strong><br><br>서울회생법원 실무준칙(제32조)에 따르면:<br><br>• 도박/투자 손실금은 <strong>청산가치에서 제외</strong>되는 경우가 많습니다<br>• 단, 반성문과 갱생계획이 필요합니다<br><br>저희 전문가들이 법원 설득 논리를 만들어 드립니다.';
      } else if (lowerText.includes('비용') || lowerText.includes('가격') || lowerText.includes('얼마')) {
        response = '<strong>아크로 올인원 패키지: 190만원</strong><br><br>포함 항목:<br>• 모든 서류 작성/접수<br>• 무제한 보정명령 대응 (추가비용 0원)<br>• AI 맞춤 진술서 작성<br>• 10개월 무이자 분납 가능<br><br>타 사무소 \'150만원~\' 광고 주의! 보정명령 1회당 30만원 추가됩니다.';
      } else if (lowerText.includes('기간') || lowerText.includes('얼마나 걸')) {
        response = '<strong>회생 진행 기간</strong><br><br>• 서류 준비: 약 1-2주<br>• 법원 접수 후 개시결정: 1-2개월<br>• 인가결정: 접수 후 4-6개월<br>• 변제기간: 36개월 (3년)<br><br>총 약 4년 정도 소요됩니다.';
      } else if (lowerText.includes('신용') || lowerText.includes('등급')) {
        response = '<strong>회생과 신용등급</strong><br><br>• 회생 신청시 신용등급이 낮아집니다<br>• 하지만 이미 연체가 있다면 큰 차이 없습니다<br>• <strong>인가결정 후 5년</strong> 지나면 기록 삭제<br>• 변제 완료 후 신용회복 가능';
      } else if (surveyResult) {
        const rate = surveyResult.repayment_rate;
        response = `고객님의 예상 변제율 <strong>${rate.toFixed(1)}%</strong>를 기준으로 말씀드리면,<br><br>`;
        if (rate < 20) {
          response += '변제율이 낮아 <strong>회생 가능성이 높습니다.</strong> 자세한 상담을 통해 최적의 방안을 찾아드리겠습니다.';
        } else if (rate < 50) {
          response += '적정한 변제율입니다. 법원 인가 가능성이 높으며, 추가 최적화 여지도 있습니다.';
        } else {
          response += '변제율이 다소 높지만, 재산/소득 구성에 따라 조정 가능합니다. 자세한 상담을 권장드립니다.';
        }
        response += '<br><br>더 궁금하신 점이 있으시면 물어봐주세요!';
      } else {
        response = '문의주셔서 감사합니다.<br><br>더 정확한 상담을 위해 텔레그램이나 전화상담을 이용해주세요.<br>담당 변호사가 직접 답변드리겠습니다!';
      }

      addMessage(response, 'bot');
      setIsLoading(false);
    }, 800 + Math.random() * 400);
  };

  const resetSurvey = () => {
    setMessages([{
      id: '1',
      type: 'bot',
      content: `안녕하세요! 👋 아크로 AI 상담사입니다.<br><br>
        몇 가지 질문에 답해주시면 <strong>예상 변제율</strong>과 <strong>월 변제금</strong>을 계산해드릴게요.<br><br>
        약 3분 정도 소요됩니다.`
    }]);
    setIsStarted(false);
    setIsLoading(false);
    setSessionId(null);
    setCurrentStep(null);
    setSelectedAnswers([]);
    setSessionAnswers({});
    setChatStepCount(0);
    setSurveyResult(null);
    setIsFreeChatMode(false);
    setFreeChatInput('');
    setFormValues({});
  };

  const shouldShowField = (field: FormField): boolean => {
    if (!field.condition) return true;

    const condition = field.condition;
    if (condition === 'rent_deposit') return sessionAnswers['step_03_housing'] === 'rent_deposit';
    if (condition === 'housing_owned') return sessionAnswers['step_03_housing'] === 'owned';

    const assetAnswers = sessionAnswers['step_07_assets'] || [];
    if (['deposit_over', 'insurance_savings', 'securities', 'crypto', 'vehicle'].includes(condition)) {
      return Array.isArray(assetAnswers) && assetAnswers.includes(condition);
    }

    if (condition === 'retirement_fund') return sessionAnswers['step_08_retirement'] === 'retirement_fund';

    return false;
  };

  const renderInputArea = () => {
    if (!isStarted) {
      return (
        <button
          onClick={startSurvey}
          className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition"
        >
          상담 시작하기
        </button>
      );
    }

    if (isLoading && !isFreeChatMode) {
      return (
        <div className="flex items-center justify-center py-4 text-stone-500">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
          분석 중...
        </div>
      );
    }

    if (isFreeChatMode) {
      return (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={freeChatInput}
              onChange={(e) => setFreeChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendFreeChat()}
              placeholder="궁금한 점을 입력하세요..."
              className="flex-1 px-4 py-3 border-2 border-stone-200 rounded-full focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={sendFreeChat}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition disabled:opacity-50"
            >
              전송
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setFreeChatInput('필요 서류가 뭔가요?'); }} className="px-3 py-1.5 text-sm border border-stone-200 rounded-full hover:border-blue-500 hover:text-blue-600 transition">필요 서류?</button>
            <button onClick={() => { setFreeChatInput('도박 빚도 되나요?'); }} className="px-3 py-1.5 text-sm border border-stone-200 rounded-full hover:border-blue-500 hover:text-blue-600 transition">도박 빚?</button>
            <button onClick={() => { setFreeChatInput('비용이 얼마인가요?'); }} className="px-3 py-1.5 text-sm border border-stone-200 rounded-full hover:border-blue-500 hover:text-blue-600 transition">비용?</button>
            <button onClick={() => (window as any).scrollToSection?.('contact')} className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition">상담 신청</button>
          </div>
        </div>
      );
    }

    if (!currentStep) return null;

    if (currentStep.input_type === 'number') {
      return (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            id="chatNumberInput"
            placeholder="0"
            onChange={(e) => e.target.value = formatNumber(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') submitAnswer();
              else if (!/[0-9]/.test(e.key)) e.preventDefault();
            }}
            className="flex-1 px-4 py-3 border-2 border-stone-200 rounded-xl text-right text-lg font-semibold focus:border-blue-500 focus:outline-none"
          />
          <span className="text-stone-500">원</span>
          <button
            onClick={() => submitAnswer()}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition"
          >
            확인
          </button>
        </div>
      );
    }

    if (currentStep.input_type === 'form' && currentStep.validation?.fields) {
      const visibleFields = currentStep.validation.fields.filter(shouldShowField);
      let currentGroup: string | null = null;

      return (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-stone-200 max-h-64 overflow-y-auto">
            <h4 className="font-bold text-stone-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded"></span>
              재산 정보 입력
            </h4>
            <p className="text-xs text-stone-500 mb-4">해당하는 항목의 금액을 입력해주세요.</p>

            {visibleFields.map((field) => {
              const showGroupHeader = field.group && field.group !== currentGroup;
              if (showGroupHeader) currentGroup = field.group!;

              return (
                <div key={field.id}>
                  {showGroupHeader && (
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-4 mb-2 pt-3 border-t border-stone-100">
                      {field.group}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="text-sm font-medium text-stone-700 mb-1 block">
                      {field.label}{field.required && ' *'}
                    </label>
                    {field.help && <p className="text-xs text-stone-400 mb-1">{field.help}</p>}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="0"
                        value={formValues[field.id]?.toLocaleString() || ''}
                        onChange={(e) => {
                          const val = parseFormattedNumber(e.target.value);
                          setFormValues(prev => ({ ...prev, [field.id]: val }));
                          e.target.value = val ? val.toLocaleString() : '';
                        }}
                        className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-right font-medium focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-sm text-stone-400">원</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => submitAnswer()}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition"
          >
            입력 완료 · 결과 계산하기
          </button>
        </div>
      );
    }

    // Options (single/multi choice)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {currentStep.options?.map((option) => (
            <button
              key={option.value}
              onClick={() => selectOption(option.value)}
              className={`px-4 py-2.5 rounded-full border-2 font-medium transition ${
                selectedAnswers.includes(option.value)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {currentStep.input_type === 'multi_choice' && (
          <button
            onClick={() => submitAnswer()}
            disabled={selectedAnswers.length === 0}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            선택 완료
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chat-container relative">
      {showLoadingOverlay && (
        <div className="absolute inset-0 bg-white/98 flex flex-col items-center justify-center z-50 rounded-3xl">
          <div className="w-14 h-14 border-4 border-stone-200 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="mt-5 text-lg font-bold text-stone-800">AI가 분석 중입니다</div>
          <div className="mt-2 text-sm text-stone-500 animate-pulse">{loadingText}</div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-stone-200 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-sm">
          AI
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-stone-800">아크로 AI 상담사</h4>
          <span className="text-xs text-stone-500">
            {isLoading ? '분석 중...' : isFreeChatMode ? '상담 중' : isStarted ? '응답 대기 중' : '대기 중'}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-1 rounded-full transition-colors ${
                i < chatStepCount ? 'bg-green-500' : i === chatStepCount && isStarted ? 'bg-blue-500' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 chat-scroll">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2.5 max-w-[85%] animate-fade-in ${
              message.type === 'bot' ? 'self-start' : 'self-end flex-row-reverse ml-auto'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
              message.type === 'bot'
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                : 'bg-stone-200 text-stone-600'
            }`}>
              {message.type === 'bot' ? 'AI' : '나'}
            </div>
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                message.type === 'bot'
                  ? 'bg-white text-stone-800 rounded-bl-sm shadow-sm'
                  : 'bg-blue-500 text-white rounded-br-sm'
              }`}
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white px-6 py-4 border-t border-stone-200">
        {renderInputArea()}
      </div>
    </div>
  );
}
