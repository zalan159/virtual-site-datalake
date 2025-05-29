from app.tasks.task_manager import TaskManager

# 创建任务管理器实例
task_manager = TaskManager()

# 提供启动和停止方法
async def start():
    await task_manager.start()

async def stop():
    await task_manager.stop() 