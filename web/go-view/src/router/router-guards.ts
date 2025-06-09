import { Router } from 'vue-router';
import { PageEnum, PreviewEnum } from '@/enums/pageEnum'

// 路由白名单 - 取消登录验证，所有路由都允许访问
const routerAllowList = [
  // 已取消登录验证，所有路由都允许
]

export function createRouterGuards(router: Router) {
  // 前置
  router.beforeEach(async (to, from, next) => {
    // http://localhost:3001/#/chart/preview/792622755697790976?t=123
    // 把外部动态参数放入window.route.params，后续API动态接口可以用window.route?.params?.t来拼接参数
    // @ts-ignore
    if (!window.route) window.route = {params: {}}
    // @ts-ignore
    Object.assign(window.route.params, to.query)

    const Loading = window['$loading'];
    Loading && Loading.start();
    const isErrorPage = router.getRoutes().findIndex((item) => item.name === to.name);
    if (isErrorPage === -1) {
      next({ name: PageEnum.ERROR_PAGE_NAME_404 })
    }

    // 取消登录验证 - 所有路由都允许访问
    // @ts-ignore
    // if (!routerAllowList.includes(to.name) && !loginCheck()) {
    //   next({ name: PageEnum.BASE_LOGIN_NAME })
    // }
    next()
  })

  router.afterEach((to, _, failure) => {
    const Loading = window['$loading'];
    document.title = (to?.meta?.title as string) || document.title;
    Loading && Loading.finish();
  })

  // 错误
  router.onError((error) => {
    console.log(error, '路由错误');
  });
}