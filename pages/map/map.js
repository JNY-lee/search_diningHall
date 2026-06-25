// 1. 填写你自己申请的腾讯地图开发者密钥
const key = 'VXUBZ-SN56Q-IDM55-47OM6-RZE3E-74FRV'

// 2. 引入腾讯地图SDK
const QQMapWX = require('../../libs/qqmap-wx-jssdk.js')

// 3. 实例化SDK
const qqmapsdk = new QQMapWX({ key: key })

Page({
  data: {
    scale: 18,          // 缩放级别
    longitude: 0,       // 地图中心点经度
    latitude: 0,        // 地图中心点纬度
    markers: [],        // 标记点数组
    mapCtx: null        // MapContext实例
  },

  // 页面加载时获取当前位置
  onLoad: function () {
    // 获取用户当前位置
    wx.getLocation({
      type: 'gcj02', // 地图坐标格式
      success: res => {
        console.log('获取位置成功', res)
        this.setData({
          longitude: res.longitude,
          latitude: res.latitude
        })
        // 获取位置后，调用附近餐厅搜索
        this.getNearbyFood(res.longitude, res.latitude)
      },
      fail: err => {
        console.error('获取位置失败', err)
        wx.showToast({
          title: '请授权位置权限',
          icon: 'none'
        })
      }
    })
  },

  // 页面渲染完成后获取地图实例
  onReady: function () {
    this.mapCtx = wx.createMapContext('myMap')
    // 初始化请求锁
    this.isSearching = false
    // 初始化防抖定时器
    this.debounceTimer = null
  },

  // 地图视野变化时更新标记点（用户拖动地图后重新搜索）
  regionChange: function (e) {
    if (e.type === 'end') {
      // 清除之前的防抖定时器
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }
      // 设置新的防抖定时器，1秒内只执行最后一次
      this.debounceTimer = setTimeout(() => {
        this.mapCtx.getCenterLocation({
          success: res => {
            console.log('地图中心点变化，重新搜索', res)
            this.getNearbyFood(res.longitude, res.latitude)
          },
          fail: err => {
            console.error('获取中心点失败', err)
          }
        })
      }, 1000) // 增加到1秒防抖
    }
  },

  // 搜索附近美食餐厅
  getNearbyFood: function (longitude, latitude) {
    // 如果正在搜索中，直接返回，不发起新请求
    if (this.isSearching) {
      console.log('⚠️ 正在搜索中，跳过本次请求')
      return
    }
    
    // 加锁
    this.isSearching = true
    
    // 显示加载提示
    wx.showLoading({
      title: '搜索附近餐厅...',
      mask: true
    })

    console.log('🔍 发起搜索请求', { longitude, latitude })

    // 调用腾讯地图周边搜索API
    qqmapsdk.search({
      keyword: '美食',
      location: `${latitude},${longitude}`,
      page_size: 20,
      page_index: 1,
      success: res => {
        wx.hideLoading()
        // 解锁
        this.isSearching = false
        console.log('✅ 搜索成功', res)
        
        let markers = []
        
        if (res.data && res.data.length > 0) {
          for (let i = 0; i < res.data.length; i++) {
            const poi = res.data[i]
            markers.push({
              id: i,
              latitude: poi.location.lat,
              longitude: poi.location.lng,
              iconPath: '/images/food.png',
              width: 30,
              height: 30,
              title: poi.title,
              content: poi.address || poi.title,
              callout: {
                content: poi.title,
                fontSize: 12,
                borderRadius: 8,
                padding: 8,
                display: 'BYCLICK'
              }
            })
          }
          console.log(`📌 找到 ${res.data.length} 家餐厅`)
        } else {
          console.log('⚠️ 附近没有找到餐厅')
          wx.showToast({
            title: '附近暂无餐厅',
            icon: 'none'
          })
        }
        
        // 添加当前位置中心点标记
        markers.push({
          id: 9999,
          latitude: latitude,
          longitude: longitude,
          iconPath: '/images/center.png',
          width: 20,
          height: 40,
          callout: {
            content: '我的位置',
            fontSize: 12,
            display: 'ALWAYS'
          }
        })
        
        this.setData({ markers: markers })
      },
      fail: err => {
        wx.hideLoading()
        // 解锁
        this.isSearching = false
        
        // 只对非QPS超限的错误显示提示
        if (err.status !== 120) {
          console.error('❌ 搜索失败:', err)
          let errorMsg = '获取附近餐厅失败'
          if (err.message) {
            if (err.message.includes('key')) {
              errorMsg = '地图Key配置错误'
            } else if (err.message.includes('permission')) {
              errorMsg = '权限不足，请检查Key配置'
            } else if (err.message.includes('network')) {
              errorMsg = '网络异常，请稍后重试'
            } else if (err.message.includes('每日调用量')) {
              errorMsg = '今日配额已用完，请明天再试'
            }
          }
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          })
        } else {
          // QPS超限静默处理，不弹窗提示
          console.log('⏰ QPS限制，跳过本次请求')
        }
        
        // 即使搜索失败，也显示当前位置标记
        this.setData({
          markers: [{
            id: 9999,
            latitude: latitude,
            longitude: longitude,
            iconPath: '/images/center.png',
            width: 20,
            height: 40
          }]
        })
      }
    })
  },

  // 点击banner跳转到优惠券页面
  bannerTap: function () {
    wx.navigateTo({
      url: '/pages/coupon/coupon',
      fail: err => {
        console.error('跳转失败', err)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
      }
    })
  },

  // 点击定位按钮，回到当前位置
  controlTap: function () {
    if (this.mapCtx) {
      this.mapCtx.moveToLocation()
      // 延迟1.5秒后再搜索，避免频繁请求
      setTimeout(() => {
        const { longitude, latitude } = this.data
        if (longitude && latitude && !this.isSearching) {
          this.getNearbyFood(longitude, latitude)
        }
      }, 1500)
    } else {
      console.error('地图实例不存在')
    }
  },

  // 页面卸载时清理定时器
  onUnload: function () {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
  }
})