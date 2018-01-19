import { ScorePage } from './../score/score';
import { CommonService } from './../../service/common.service';
import { ExamService } from './../../service/exam.service';
import { Component, OnInit } from '@angular/core';
import { NavController } from 'ionic-angular';
import { ViewChild } from '@angular/core';
import { Slides } from 'ionic-angular';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit {

  @ViewChild(Slides) slides: Slides;

  exam: Exam; //当前的考试科目
  title: string;
  options: string[] = ['正确', '错误'];
  allQuestions: Question[] = []; // 从服务器请求回来的数据
  allQuestionsAfterFormat: MyQuestion[] = []; // 对选项进行处理，扁平化
  userAnswer: UserAnswer[] = [];
  canClick: boolean = false;  // 是否可以点击确定按钮。要求先选择答案才能点
  countdownMinute: string = '01';  //倒计时分钟
  countdownSecond: string = '30';  //倒计时秒数
  interval_id: any; 

  // 用户答错题目的详细信息，“查看错题”页面要用到
  wrongAnswers: {
    questionTitle: string,
    userAnswerDesc: string[],
    rightAnswerDesc: string[]
  }[] = [];
  constructor(
    public navCtrl: NavController,
    private service: ExamService,
    private commonService: CommonService
  ) {

  }

  ngOnInit() {
    // this.slides.lockSwipes(true);
    this.service.getExamById(1)
      .map((r) => r.json().result)
      .subscribe(res => {
        this.exam = res;
      });

    this.service.getQuestionsByExamId(1)
      .map((r) => r.json().result)
      .subscribe((res) => {
        this.allQuestions = res;
        this.allQuestionsAfterFormat = this.formatData(this.allQuestions);
      });


    this.interval_id = setInterval(() => {
      this.countDown();
    }, 1000);

  }


  getUserAnswer(e, index: number, questionId: number, rightAnswer: string, num: number, score: number) {
    this.userAnswer[index] = {
      questionId: questionId,
      userAnswer: e,
      rightAnswer: rightAnswer,
      num: num,
      score: score
    };
    // this.canClick = true;
  }

  goToNextQuestion() {
    this.slides.lockSwipes(false);
    this.canClick = false;
    this.slides.slideNext();
    this.slides.lockSwipes(true);
  }

  // 交卷
  finish() {  
    this.commonService.showOptionConfirm('提示', '确定要交卷吗？', async () => {
      this.finishConfirm();
    });
  }

  async finishConfirm() {
    // 获取真实的user id，目前hard code 1
    let userId = 1;
    // 1.把错题保存在本地，后面查看错题使用
    this.userAnswer.forEach((value, index) => {
      if (value.rightAnswer !== value.userAnswer) {
        let temp = {
          questionTitle: this.getQuestionTitle(value.questionId),
          userAnswerDesc: this.getAnswerTitle(value.questionId, value.userAnswer),
          rightAnswerDesc: this.getAnswerTitle(value.questionId, value.rightAnswer),
        }
        this.wrongAnswers.push(temp);
      }
    });

    // 2. 计算分数，把用户的答案保存到数据库
    let score = this.calScore();
    let res = await this.service.getAnswerSeq(userId).toPromise();
    let seq = res.json().result;
    let questionIds = this.userAnswer.map((value, index) => value.questionId);
    let answers = this.userAnswer.map((value, index) => value.userAnswer);
    let body = {
      examId: this.exam.id,
      questionIds: questionIds,
      userId: userId,
      seq: (seq ? seq : 0) + 1,
      answers: answers
    }
    await this.service.insertAnswer(body).toPromise();

    this.navCtrl.setRoot(ScorePage, {
      actualScore: score,
      passScore: this.exam.passScore,
      wrongAnswers: this.wrongAnswers
    });
  }

  getQuestionTitle(questionId: number) {
    let result = this.allQuestions.filter((value, index) => value.id === questionId)[0].title;
    return result;
  }

  getAnswerTitle(questionId: number, answers: string) {
    let result: string[] = [];
    let question = this.allQuestions.filter((value, index) => value.id === questionId)[0];
    if (question.type === 'TF') {
      if (answers === 'Y') {
        result.push('正确');
      } else {
        result.push('错误');
      }
    } else {
      let ansArray = answers.split(',');
      ansArray.forEach((value, index) => {
        if (value === 'A') {
          result.push(question.optionA);
        } else if (value === 'B') {
          result.push(question.optionB);
        } else if (value === 'C') {
          result.push(question.optionC);
        }
        else if (value === 'D') {
          result.push(question.optionD);
        }
        else if (value === 'E') {
          result.push(question.optionE);
        }
      });
    }
    return result;
  }

  // 计算得分
  calScore() {
    let score: number = 0;
    this.userAnswer.forEach((value, index) => {
      if (value.userAnswer === value.rightAnswer) {
        score += value.score;
      }
    });
    return score;
  }

  prevQuestion() {
    this.slides.slidePrev();
  }

  nextQuestion() {
    this.slides.slideNext();
  }

  hasPrev(num: number) {
    let q = this.userAnswer.filter(q => (q.num == num - 1)).length;
    if (q > 0) {
      return true;
    } else {
      return false;
    }
  }

  hasNext(num: number) {
    let q = this.userAnswer.filter(q => (q.num == num)).length;
    if (q > 0) {
      return true;
    } else {
      return false;
    }
  }

  //倒計時，到時自動提交問卷 
  countDown() {
    let minute: number = parseInt(this.countdownMinute);
    let second: number = parseInt(this.countdownSecond);
    if (minute == 0 && second == 0) {
      clearInterval(this.interval_id);
      this.finishConfirm();
    } else {
      if (second == 0) {
        minute = minute - 1;
        second = 59;
      } else {
        second = second - 1;
      }
      this.countdownMinute = this.fillZero(minute) + '';
      this.countdownSecond = this.fillZero(second) + '';
    }
  }

  fillZero(v: any) {
    if (v < 10) { v = '0' + v; }
    return v;
  }

  formatData(question: Question[]): MyQuestion[] {
    let myQuestions: MyQuestion[] = [];

    for (let i = 0; i < question.length; i++) {
      let temp = new MyQuestion();
      let options: string[] = [];
      temp.examId = question[i].examId;
      temp.id = question[i].id;
      temp.num = question[i].num;
      temp.rightAnswer = question[i].rightAnswer;
      temp.score = question[i].score;
      temp.title = question[i].title;
      temp.type = question[i].type;
      if (temp.type === 'TF') {
        options.push('正确', '错误');
      } else {
        if (question[i].optionA) {
          options.push(question[i].optionA);
        }
        if (question[i].optionB) {
          options.push(question[i].optionB);
        }
        if (question[i].optionC) {
          options.push(question[i].optionC);
        }
        if (question[i].optionD) {
          options.push(question[i].optionD);
        }
        if (question[i].optionE) {
          options.push(question[i].optionE);
        }
      }

      temp.options = options;
      myQuestions.push(temp);
    }
    return myQuestions;
  }

}

class Question {
  examId: number;
  id: number;
  num: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  rightAnswer: string;
  score: number;
  title: string;
  type: string;
}

class MyQuestion {
  examId: number;
  id: number;
  num: number;
  options: string[];
  rightAnswer: string;
  score: number;
  title: string;
  type: string;
}

class Exam {
  code: string;
  companyId: string;
  id: number;
  passScore: number;
  refDept: string;
  time: number;
  title: string;
  version: string;
}

class UserAnswer {
  questionId: number;
  userAnswer: string;
  rightAnswer: string;
  num: number;
  score: number;
}