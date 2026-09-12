// IPC 通道白名单：主进程与预加载脚本共享，通道必须在此登记后方可使用
export const IPC = {
  // 窗口
  WinToggle: 'win:toggle',
  WinSetPinned: 'win:setPinned',
  WinGetState: 'win:getState',
  WinCollapse: 'win:collapse',
  WinMinimize: 'win:minimize',
  // 文件对话框与读写
  DialogOpenFile: 'dialog:openFile',
  DialogSaveAs: 'dialog:saveAs',
  FileWrite: 'file:write',
  FileWriteBinary: 'file:writeBinary',
  FileReadAsset: 'file:readAsset',
  FileStatMtime: 'file:statMtime',
  FileMigrateAssets: 'file:migrateAssets',
  FileChanged: 'file:changed',
  // 草稿
  DraftSave: 'draft:save',
  DraftLoad: 'draft:load',
  DraftClear: 'draft:clear',
  // 未命名文档的涂鸦资产（userData/pending-assets/<tabId>/）
  PendingWrite: 'pending:write',
  // 设置与最近文件
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
  RecentAdd: 'recent:add',
  // 应用
  AppQuit: 'app:quit',
  AppQuitRequest: 'app:quit-request',
  EditorFocus: 'editor:focus'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
